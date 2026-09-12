// Check which staff have an active (recent) location in DB
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const staffProfiles = await db.collection('staffprofiles').find({}).toArray();
  console.log(`📋 Total StaffProfiles: ${staffProfiles.length}\n`);

  const now = Date.now();
  const STALE_MS = 30 * 60 * 1000; // 30 min

  let activeCount = 0;
  let staleCount = 0;
  let noLocationCount = 0;

  console.log('┌─────┬──────────────────────────────────┬──────────────┬────────────┬────────────┬──────────┐');
  console.log('│  #  │ userId                           │ services     │ kycStatus  │ status     │ age      │');
  console.log('├─────┼──────────────────────────────────┼──────────────┼────────────┼────────────┼──────────┤');

  for (let i = 0; i < staffProfiles.length; i++) {
    const p = staffProfiles[i];
    const services = (p.services || []).join(',').slice(0, 12) || '-';
    const kyc = p.kycStatus || '-';

    let status, age;
    if (!p.location || !p.location.coordinates) {
      status = '❌ no loc';
      age = '-';
      noLocationCount++;
    } else if (!p.lastLocationUpdateAt) {
      status = '⚠️  no ts';
      age = '-';
      noLocationCount++;
    } else {
      const ageMs = now - new Date(p.lastLocationUpdateAt).getTime();
      const ageMin = Math.floor(ageMs / 60000);
      if (ageMs < STALE_MS) {
        status = '✅ ACTIVE';
        age = `${ageMin} min`;
        activeCount++;
      } else {
        status = '⏰ STALE';
        age = `${Math.floor(ageMin / 60)}h ${ageMin % 60}m`;
        staleCount++;
      }
    }

    const id = String(p.userId).slice(-20).padEnd(20);
    console.log(`│ ${String(i + 1).padStart(3)} │ ${id}  │ ${services.padEnd(12)} │ ${kyc.padEnd(10)} │ ${status.padEnd(10)} │ ${age.padEnd(8)} │`);
  }

  console.log('└─────┴──────────────────────────────────┴──────────────┴────────────┴────────────┴──────────┘');
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Active (will show in search): ${activeCount}`);
  console.log(`   ⏰ Stale (won't show — >30 min): ${staleCount}`);
  console.log(`   ❌ No location (won't show):      ${noLocationCount}`);

  // Show full details of any active staff
  if (activeCount > 0) {
    console.log(`\n🎯 Active staff details:`);
    for (const p of staffProfiles) {
      if (p.location && p.lastLocationUpdateAt) {
        const ageMs = now - new Date(p.lastLocationUpdateAt).getTime();
        if (ageMs < STALE_MS) {
          console.log(`   userId=${p.userId}`);
          console.log(`     coords: ${JSON.stringify(p.location.coordinates)} (lng, lat)`);
          console.log(`     pushed: ${p.lastLocationUpdateAt.toISOString()}`);
          console.log(`     services: ${JSON.stringify(p.services)}`);
          console.log('');
        }
      }
    }
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });