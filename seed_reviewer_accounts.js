const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://sangihomeservices_db_user:0kSCDmDJFsT322Tj@cluster0.evkj0zu.mongodb.net/sangi?retryWrites=true&w=majority';

async function seed() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const passwordHash = await bcrypt.hash('Password@123', 12);

  // 1. Customer Reviewer (9876543210)
  const customerUser = await mongoose.connection.collection('users').findOneAndUpdate(
    { phone: '9876543210' },
    {
      $set: {
        fullName: 'SANGI Customer Reviewer',
        email: 'customer.reviewer@sangi.in',
        phone: '9876543210',
        passwordHash,
        role: 'customer',
        isPhoneVerified: true,
        isBlocked: false,
        walletBalance: 500,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        referralCode: 'SANGI-REV01',
      }
    },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('Customer Reviewer configured:', customerUser.phone, customerUser.role);

  // 2. Staff / Service Partner Reviewer (8888888888)
  const staffUser = await mongoose.connection.collection('users').findOneAndUpdate(
    { phone: '8888888888' },
    {
      $set: {
        fullName: 'SANGI Partner Reviewer',
        email: 'partner.reviewer@sangi.in',
        phone: '8888888888',
        passwordHash,
        role: 'staff',
        isPhoneVerified: true,
        isBlocked: false,
        walletBalance: 1200,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
        referralCode: 'SANGI-REV02',
      }
    },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('Staff Reviewer configured:', staffUser.phone, staffUser.role);

  // Get available services
  const services = await mongoose.connection.collection('services').find({}).toArray();
  const serviceIds = services.map(s => String(s._id));

  // Staff profile for 8888888888
  await mongoose.connection.collection('staffprofiles').findOneAndUpdate(
    { userId: staffUser._id },
    {
      $set: {
        userId: staffUser._id,
        title: 'Senior Home Specialist',
        about: 'Verified senior professional on SANGI with 5+ years experience.',
        experience: '5+ years',
        services: serviceIds,
        serviceArea: 'Delhi NCR',
        rating: 4.9,
        reviewCount: 28,
        isKycVerified: true,
        kycStatus: 'approved',
        kyc: {
          aadhaarFrontUrl: 'https://ik.imagekit.io/nexbharat/demo-doc.jpg',
          aadhaarBackUrl: 'https://ik.imagekit.io/nexbharat/demo-doc.jpg',
          panCardUrl: 'https://ik.imagekit.io/nexbharat/demo-doc.jpg',
        },
        availability: {
          monday: { isAvailable: true, start: '08:00', end: '20:00' },
          tuesday: { isAvailable: true, start: '08:00', end: '20:00' },
          wednesday: { isAvailable: true, start: '08:00', end: '20:00' },
          thursday: { isAvailable: true, start: '08:00', end: '20:00' },
          friday: { isAvailable: true, start: '08:00', end: '20:00' },
          saturday: { isAvailable: true, start: '09:00', end: '19:00' },
          sunday: { isAvailable: true, start: '09:00', end: '18:00' },
        },
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      }
    },
    { upsert: true }
  );
  console.log('Staff profile created & approved for 8888888888');

  await mongoose.disconnect();
  console.log('Done!');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

