require('dotenv').config({ path: 'd:/projects/SANGI-PACK/SANGI-BACKEND/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const initialServices = [
  {
    slug: 'cleaning',
    name: 'Home Deep Cleaning',
    category: 'Cleaning & Pest',
    imageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
    bookingFee: 49,
    basePrice: 499,
    description: 'Complete home deep cleaning, bathroom sanitation, kitchen scrubbing and dust removal.',
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: 'electrician',
    name: 'Electrician Services',
    category: 'Repairs & Fixes',
    imageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
    bookingFee: 30,
    basePrice: 199,
    description: 'Wiring repair, fan installation, switchboard replacement, and fuse box diagnostics.',
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: 'plumber',
    name: 'Plumbing & Pipe Repair',
    category: 'Repairs & Fixes',
    imageUrl: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=600&q=80',
    bookingFee: 30,
    basePrice: 249,
    description: 'Leakage fixing, tap replacement, bathroom fitting installation, and blockage clearing.',
    sortOrder: 3,
    isActive: true,
  },
  {
    slug: 'laundry',
    name: 'Laundry & Dry Clean',
    category: 'Daily Living',
    imageUrl: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=600&q=80',
    bookingFee: 30,
    basePrice: 149,
    description: 'Doorstep pickup, steam ironing, premium wash and dry cleaning for everyday wear.',
    sortOrder: 4,
    isActive: true,
  },
  {
    slug: 'appliance_repair',
    name: 'AC & Appliance Repair',
    category: 'Repairs & Fixes',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
    bookingFee: 49,
    basePrice: 399,
    description: 'AC servicing, gas refill, refrigerator, washing machine, and microwave servicing.',
    sortOrder: 5,
    isActive: true,
  },
  {
    slug: 'painting',
    name: 'Home Painting & Polish',
    category: 'Home Improvement',
    imageUrl: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=600&q=80',
    bookingFee: 99,
    basePrice: 999,
    description: 'Interior wall painting, texture coats, waterproofing, and door varnishing.',
    sortOrder: 6,
    isActive: true,
  },
  {
    slug: 'pest_control',
    name: 'Pest Control & Sanitization',
    category: 'Cleaning & Pest',
    imageUrl: 'https://images.unsplash.com/photo-1632733711679-529326f6db37?auto=format&fit=crop&w=600&q=80',
    bookingFee: 49,
    basePrice: 599,
    description: 'Eco-friendly cockroach, termite, bed bug, and rodent eradication.',
    sortOrder: 7,
    isActive: true,
  },
  {
    slug: 'carpenter',
    name: 'Carpentry & Furniture',
    category: 'Home Improvement',
    imageUrl: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=600&q=80',
    bookingFee: 49,
    basePrice: 349,
    description: 'Furniture assembly, hinge repair, door lock installation, and custom wooden fixtures.',
    sortOrder: 8,
    isActive: true,
  },
];

(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('Connecting to DB...');
    await mongoose.connect(mongoUri);
    const db = mongoose.connection.db;

    // 1. Seed or update Admin User
    const adminEmail = 'admin@sangi.in';
    const adminPhone = '9999999999';
    const passwordHash = await bcrypt.hash('Admin@Sangi2026!', 10);

    const existingAdmin = await db.collection('users').findOne({ email: adminEmail });
    if (!existingAdmin) {
      await db.collection('users').insertOne({
        fullName: 'SANGI Super Admin',
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: 'admin',
        isPhoneVerified: true,
        isBlocked: false,
        walletBalance: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Created Admin user: admin@sangi.in / Admin@Sangi2026!');
    } else {
      await db.collection('users').updateOne(
        { _id: existingAdmin._id },
        { $set: { role: 'admin', passwordHash, isBlocked: false, updatedAt: new Date() } }
      );
      console.log('✅ Admin user already exists, updated password and role: admin@sangi.in / Admin@Sangi2026!');
    }

    // 2. Seed services
    for (const s of initialServices) {
      const exists = await db.collection('services').findOne({ slug: s.slug });
      if (!exists) {
        await db.collection('services').insertOne({
          ...s,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Seeded service: ${s.name}`);
      } else {
        await db.collection('services').updateOne(
          { slug: s.slug },
          { $set: { ...s, updatedAt: new Date() } }
        );
        console.log(`ℹ️ Updated service: ${s.name}`);
      }
    }

    console.log('\n🎉 Database setup & seeding completed successfully!');
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  }
})();
