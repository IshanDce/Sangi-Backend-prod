// List all staff users with their full details
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({ role: 'staff' }).toArray();
  console.log(`👥 Total staff users: ${users.length}\n`);

  const now = Date.now();
  const STALE_MS = 30 * 60 * 1000;

  console.log('┌─────┬─────────────────┬──────────────┬──────────────┬────────────┬───────────────┐');
  console.log('│  #  │ fullName        │ phone        │ email        │ KYC        │ location      │');
  console.log('├─────┼─────────────────┼──────────────┼──────────────┼────────────┼───────────────┤');

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const profile = await db.collection('staffprofiles').findOne({ userId: u._id });

    let kyc = '— no profile —';
    if (profile) {
      kyc = profile.kycStatus || 'unknown';
    }

    let loc = '— none —';
    if (profile && profile.location && profile.location.coordinates) {
      const ageMs = profile.lastLocationUpdateAt ? (now - new Date(profile.lastLocationUpdateAt).getTime()) : Infinity;
      if (ageMs < STALE_MS) {
        const ageMin = Math.floor(ageMs / 60000);
        loc = `✅ LIVE (${ageMin}m ago)`;
      } else {
        loc = `⏰ stale`;
      }
    }

    const name = (u.fullName || '?').slice(0, 15).padEnd(15);
    const phone = String(u.phone || '?').slice(0, 12).padEnd(12);
    const email = (u.email || '?').slice(0, 12).padEnd(12);

    console.log(`│ ${String(i + 1).padStart(3)} │ ${name} │ ${phone} │ ${email} │ ${kyc.padEnd(10)} │ ${loc.padEnd(13)} │`);
  }

  console.log('└─────┴─────────────────┴──────────────┴──────────────┴────────────┴───────────────┘');
  console.log('\n→ Reply with the name / phone / email of the staff you want to inspect in detail.');

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });