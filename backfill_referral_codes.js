const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to:', uri ? uri.replace(/:([^@]+)@/, ':***@') : 'NOT SET');
  await mongoose.connect(uri);
  
  const users = await mongoose.connection.db.collection('users')
    .find({}, { projection: { fullName: 1, role: 1, referralCode: 1 } })
    .limit(30).toArray();
  
  console.log('\n=== Users in DB ===');
  let missing = 0;
  users.forEach(u => {
    const code = u.referralCode || 'MISSING';
    if (!u.referralCode) missing++;
    console.log('  ' + u.fullName + ' (' + u.role + ') -> referralCode: ' + code);
  });
  
  console.log('\nTotal: ' + users.length + ', Missing referralCode: ' + missing);
  
  if (missing > 0) {
    console.log('\n=== Generating referral codes for existing users ===');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    
    const usersWithout = await mongoose.connection.db.collection('users')
      .find({ $or: [{ referralCode: null }, { referralCode: { $exists: false } }] })
      .toArray();
    
    for (const u of usersWithout) {
      let code, exists;
      do {
        code = 'SANGI-';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        exists = await mongoose.connection.db.collection('users').findOne({ referralCode: code });
      } while (exists);
      
      await mongoose.connection.db.collection('users').updateOne(
        { _id: u._id },
        { $set: { referralCode: code, referralCount: 0 } }
      );
      console.log('  ' + u.fullName + ' -> ' + code);
    }
    console.log('\nDone! All users now have referral codes.');
  } else {
    console.log('\nAll users already have referral codes!');
  }
  
  await mongoose.disconnect();
}

check().catch(e => console.error(e));
