// Check specific staff by email
const EMAIL = process.argv[2] || 'mmm@gmail.com';
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: EMAIL });
  if (!user) {
    console.log(`❌ User NOT FOUND for email: ${EMAIL}`);
    await mongoose.disconnect();
    return;
  }

  const profile = await db.collection('staffprofiles').findOne({ userId: user._id });

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log(`║ STAFF STATUS: ${EMAIL.padEnd(38)}║`);
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  console.log('👤 USER:');
  console.log(`   _id:             ${user._id}`);
  console.log(`   fullName:        ${user.fullName}`);
  console.log(`   phone:           ${user.phone}`);
  console.log(`   email:           ${user.email}`);
  console.log(`   role:            ${user.role}`);
  console.log(`   isPhoneVerified: ${user.isPhoneVerified}`);
  console.log(`   createdAt:       ${user.createdAt?.toISOString()}`);

  console.log('\n📋 STAFF PROFILE:');
  if (!profile) {
    console.log('   ❌ NOT FOUND — registration step 1 failed');
  } else {
    console.log(`   _id:             ${profile._id}`);
    console.log(`   services:        ${JSON.stringify(profile.services)}`);
    console.log(`   experience:      ${profile.experience}`);
    console.log(`   about:           ${(profile.about || '').slice(0, 50)}`);
    console.log(`   isKycVerified:   ${profile.isKycVerified}`);
    console.log(`   kycStatus:       ${profile.kycStatus}`);

    console.log('\n📄 KYC Documents:');
    console.log(`   aadhaarFront: ${profile.kyc?.aadhaarFrontUrl ? '✅ uploaded' : '❌ missing'}`);
    console.log(`   aadhaarBack:  ${profile.kyc?.aadhaarBackUrl ? '✅ uploaded' : '❌ missing'}`);
    console.log(`   panCard:      ${profile.kyc?.panCardUrl ? '✅ uploaded' : '❌ missing'}`);

    console.log('\n📍 LOCATION:');
    if (profile.location?.coordinates) {
      const [lng, lat] = profile.location.coordinates;
      console.log(`   coords:       [${lng}, ${lat}] (lng, lat)`);
      console.log(`   lastUpdateAt: ${profile.lastLocationUpdateAt?.toISOString()}`);
      if (profile.lastLocationUpdateAt) {
        const ageMin = Math.floor((Date.now() - new Date(profile.lastLocationUpdateAt).getTime()) / 60000);
        console.log(`   age:          ${ageMin} min ago`);
        if (ageMin < 30) console.log(`   status:       ✅ LIVE`);
        else console.log(`   status:       ⏰ STALE`);
      }
    } else {
      console.log('   ❌ NO LOCATION — staff has not pushed GPS yet');
    }
  }

  console.log('\n' + '─'.repeat(55));
  console.log('📊 VERDICT:');
  if (!profile) {
    console.log('   ❌ Profile missing — registration broken');
  } else if (profile.kycStatus !== 'approved') {
    console.log(`   ⏳ KYC: ${profile.kycStatus.toUpperCase()} — admin has NOT verified yet`);
  } else {
    console.log('   ✅ KYC: APPROVED');
  }

  if (profile?.location?.coordinates && profile?.lastLocationUpdateAt) {
    const ageMin = (Date.now() - new Date(profile.lastLocationUpdateAt).getTime()) / 60000;
    if (ageMin < 30) {
      console.log('   ✅ LOCATION: LIVE — will appear in customer search');
    } else {
      console.log(`   ⏰ LOCATION: STALE (${Math.floor(ageMin)} min) — won't show`);
    }
  } else {
    console.log('   ❌ LOCATION: NOT PUSHED — staff app has not started tracking');
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });