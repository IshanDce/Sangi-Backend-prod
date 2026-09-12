// Check status of new staff (new11@gmail.com / 8888888889)
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Find user
  const user = await db.collection('users').findOne({
    $or: [{ email: 'new11@gmail.com' }, { phone: '8888888889' }]
  });

  if (!user) {
    console.log('❌ User NOT FOUND in DB');
    console.log('   Email: new11@gmail.com');
    console.log('   Phone: 8888888889');
    console.log('\n→ Registration FAILED. Check backend logs for errors.');
    await mongoose.disconnect();
    return;
  }

  console.log('✅ USER FOUND:');
  console.log(`   _id:      ${user._id}`);
  console.log(`   fullName: ${user.fullName}`);
  console.log(`   email:    ${user.email}`);
  console.log(`   phone:    ${user.phone}`);
  console.log(`   role:     ${user.role}`);
  console.log(`   isPhoneVerified: ${user.isPhoneVerified}`);
  console.log(`   createdAt: ${user.createdAt}`);

  // Find StaffProfile
  const profile = await db.collection('staffprofiles').findOne({ userId: user._id });

  if (!profile) {
    console.log('\n❌ StaffProfile NOT FOUND — registration incomplete');
    console.log('   User exists but step 1 (profile creation) failed');
    await mongoose.disconnect();
    return;
  }

  console.log('\n✅ STAFF PROFILE FOUND:');
  console.log(`   _id:           ${profile._id}`);
  console.log(`   userId:        ${profile.userId}`);
  console.log(`   services:      ${JSON.stringify(profile.services)}`);
  console.log(`   experience:    ${profile.experience}`);
  console.log(`   about:         ${(profile.about || '').slice(0, 60)}`);
  console.log(`   isKycVerified: ${profile.isKycVerified}`);
  console.log(`   kycStatus:     ${profile.kycStatus}`);

  // KYC details
  if (profile.kyc) {
    console.log('\n📄 KYC Documents:');
    console.log(`   aadhaarFront: ${profile.kyc.aadhaarFrontUrl ? '✅ uploaded' : '❌ missing'}`);
    console.log(`   aadhaarBack:  ${profile.kyc.aadhaarBackUrl ? '✅ uploaded' : '❌ missing'}`);
    console.log(`   panCard:      ${profile.kyc.panCardUrl ? '✅ uploaded' : '❌ missing'}`);
  }

  // Location
  console.log('\n📍 LOCATION:');
  if (profile.location && profile.location.coordinates) {
    const [lng, lat] = profile.location.coordinates;
    console.log(`   coords:       [${lng}, ${lat}] (lng, lat)`);
    console.log(`   type:         ${profile.location.type}`);
    console.log(`   lastUpdateAt: ${profile.lastLocationUpdateAt}`);
    if (profile.lastLocationUpdateAt) {
      const ageMin = Math.floor((Date.now() - new Date(profile.lastLocationUpdateAt).getTime()) / 60000);
      console.log(`   age:          ${ageMin} min ago`);
    }
  } else {
    console.log('   ❌ NO LOCATION — staff app has not pushed GPS yet');
  }

  // Check token/fcm
  console.log('\n🔐 AUTH:');
  console.log(`   fcmToken: ${user.fcmToken ? '✅ registered' : '❌ not set'}`);

  // Verdict
  console.log('\n' + '═'.repeat(50));
  if (profile.kycStatus === 'approved') {
    console.log('✅ KYC: APPROVED — eligible to appear in customer search');
  } else if (profile.kycStatus === 'pending') {
    console.log('⏳ KYC: PENDING — needs admin approval to appear in search');
  } else if (profile.kycStatus === 'rejected') {
    console.log('❌ KYC: REJECTED — ' + (profile.kyc?.rejectionReason || 'no reason'));
  } else {
    console.log('⚠️  KYC: NOT SUBMITTED — staff has not uploaded docs yet');
  }

  if (profile.location && profile.location.coordinates && profile.lastLocationUpdateAt) {
    const ageMin = (Date.now() - new Date(profile.lastLocationUpdateAt).getTime()) / 60000;
    if (ageMin < 30) {
      console.log('✅ LOCATION: LIVE — will show in customer search with real km');
    } else {
      console.log(`⏰ LOCATION: STALE (${Math.floor(ageMin)} min ago) — won't show until fresh push`);
    }
  } else {
    console.log('❌ LOCATION: NOT PUSHED — staff has not started tracking yet');
  }

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });