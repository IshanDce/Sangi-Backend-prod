require('dotenv').config();
const crypto = require('crypto');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api/v1';
const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'your_razorpay_key_secret';

// Helper: 1x1 valid JPEG Buffer
const SAMPLE_JPEG_BUFFER = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

function logStep(stepNum, title) {
  console.log(`\n======================================================`);
  console.log(`📌 STEP ${stepNum}: ${title}`);
  console.log(`======================================================`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

function generateRazorpaySig(orderId, paymentId) {
  return crypto
    .createHmac('sha256', RAZORPAY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runE2ETest() {
  console.log(`🚀 Starting SANGI Backend Full E2E Flow Test...`);

  // ----------------------------------------------------
  // STEP 1: Health Check
  // ----------------------------------------------------
  logStep(1, 'Backend Health Check');
  const healthRes = await fetch('http://localhost:5000/health');
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === 'ok', 'Server is healthy');

  // ----------------------------------------------------
  // STEP 2: Customer Registration & Authentication
  // ----------------------------------------------------
  logStep(2, 'Customer Registration & OTP Auth');
  const custPhone = `98765${Math.floor(10005 + Math.random() * 89995)}`;
  const custEmail = `customer_${Date.now()}@sangi.test`;
  
  const regCustRes = await fetch(`${BASE_URL}/auth/register/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rahul Sharma (Customer)',
      email: custEmail,
      phone: custPhone,
      password: 'password123',
    }),
  });
  const regCustData = await regCustRes.json();
  assert(regCustRes.status === 201 && regCustData.success, 'Customer registered successfully');

  // Send OTP
  const sendOtpRes = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: custPhone, purpose: 'login' }),
  });
  const sendOtpData = await sendOtpRes.json();
  if (!sendOtpData.success) {
    console.error('sendOtp failed with response:', sendOtpRes.status, sendOtpData);
  }
  assert(sendOtpData.success, 'OTP sent to customer');

  // Verify OTP (123456)
  const verifyOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: custPhone, otp: '123456' }),
  });
  const verifyOtpData = await verifyOtpRes.json();
  assert(verifyOtpData.success && verifyOtpData.accessToken, 'Customer verified OTP & received JWT token');
  const custToken = verifyOtpData.accessToken;
  const custId = verifyOtpData.user.id;

  // ----------------------------------------------------
  // STEP 3: Customer Profile Image Upload to ImageKit
  // ----------------------------------------------------
  logStep(3, 'Customer ImageKit Upload (Profile Photo)');
  const custPhotoForm = new FormData();
  const custBlob = new Blob([SAMPLE_JPEG_BUFFER], { type: 'image/jpeg' });
  custPhotoForm.append('photo', custBlob, 'cust_profile.jpg');

  const uploadCustPhotoRes = await fetch(`${BASE_URL}/users/me/photo`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${custToken}` },
    body: custPhotoForm,
  });
  const uploadCustPhotoData = await uploadCustPhotoRes.json();
  assert(
    uploadCustPhotoRes.status === 200 && uploadCustPhotoData.profilePhotoUrl,
    `Customer photo uploaded to ImageKit CDN: ${uploadCustPhotoData.profilePhotoUrl}`
  );

  // ----------------------------------------------------
  // STEP 4: Staff 4-Step Registration & ImageKit KYC Upload
  // ----------------------------------------------------
  logStep(4, 'Staff 4-Step Registration & KYC');
  const staffPhone = `91234${Math.floor(10005 + Math.random() * 89995)}`;
  const staffEmail = `staff_${Date.now()}@sangi.test`;

  // Step 1: Basic Info
  const staffStep1Res = await fetch(`${BASE_URL}/staff/register/step1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Vikram Singh (Plumber/Cleaner)',
      email: staffEmail,
      phone: staffPhone,
      password: 'password123',
      experience: 5,
      about: 'Expert home cleaning and plumbing professional with 5 years experience',
    }),
  });
  const staffStep1Data = await staffStep1Res.json();
  if (!staffStep1Data.success) {
    console.error('staffStep1 failed with response:', staffStep1Res.status, staffStep1Data);
  }
  assert(staffStep1Res.status === 201 && staffStep1Data.success, 'Staff Step 1 complete');

  // Send OTP to staff phone
  await fetch(`${BASE_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: staffPhone, purpose: 'login' }),
  });

  // Verify Staff OTP
  const verifyStaffOtpRes = await fetch(`${BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: staffPhone, otp: '123456' }),
  });
  const verifyStaffOtpData = await verifyStaffOtpRes.json();
  assert(verifyStaffOtpData.success && verifyStaffOtpData.accessToken, 'Staff verified OTP & received JWT token');
  const staffToken = verifyStaffOtpData.accessToken;
  const staffId = verifyStaffOtpData.user.id;

  // Step 2: Services
  const staffStep2Res = await fetch(`${BASE_URL}/staff/register/step2-services`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      services: ['House Cleaning', 'Deep Kitchen Cleaning', 'Plumbing'],
    }),
  });
  const staffStep2Data = await staffStep2Res.json();
  assert(staffStep2Data.success && staffStep2Data.staffProfile.services.length === 3, 'Staff Step 2 (Services) complete');

  // Step 3: Availability
  const staffStep3Res = await fetch(`${BASE_URL}/staff/register/step3-availability`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      availability: {
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        workingHours: { start: '09:00', end: '19:00' },
        serviceRadiusKm: 15,
      },
    }),
  });
  const staffStep3Data = await staffStep3Res.json();
  assert(staffStep3Data.success, 'Staff Step 3 (Availability) complete');

  // Step 4: KYC Documents Upload (Aadhaar & PAN to ImageKit)
  const kycForm = new FormData();
  const aadhaarFrontBlob = new Blob([SAMPLE_JPEG_BUFFER], { type: 'image/jpeg' });
  const aadhaarBackBlob = new Blob([SAMPLE_JPEG_BUFFER], { type: 'image/jpeg' });
  const panBlob = new Blob([SAMPLE_JPEG_BUFFER], { type: 'image/jpeg' });

  kycForm.append('aadhaarFront', aadhaarFrontBlob, 'aadhaar_front.jpg');
  kycForm.append('aadhaarBack', aadhaarBackBlob, 'aadhaar_back.jpg');
  kycForm.append('panCard', panBlob, 'pan_card.jpg');

  const kycRes = await fetch(`${BASE_URL}/staff/register/step4-kyc`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: kycForm,
  });
  const kycData = await kycRes.json();
  assert(
    kycRes.status === 200 && kycData.success && kycData.kycStatus === 'pending',
    `Staff Step 4 (KYC Images Uploaded to ImageKit) complete! Front URL: ${kycData.staffProfile.kyc.aadhaarFrontUrl}`
  );

  // ----------------------------------------------------
  // STEP 5: Approve Staff KYC & Search Discovery
  // ----------------------------------------------------
  logStep(5, 'Approve Staff & Search Discovery');
  // Directly set staff KYC to approved in MongoDB via Mongoose helper script or direct route update
  // Let's connect to mongoose to approve staff
  const mongoose = require('mongoose');
  const { StaffProfile } = require('./dist/models/StaffProfile');
  await mongoose.connect(process.env.MONGODB_URI);
  await StaffProfile.findOneAndUpdate(
    { userId: staffId },
    { kycStatus: 'approved', isKycVerified: true, title: 'Senior House Cleaning Specialist' }
  );
  console.log(`ℹ️ Approved staff KYC in DB`);

  // Search Staff as Customer
  const searchRes = await fetch(`${BASE_URL}/staff/search?service=House Cleaning`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  const searchData = await searchRes.json();
  assert(
    searchRes.status === 200 && searchData.results.some((s) => s.id === staffId),
    'Customer successfully searched and discovered registered staff!'
  );

  // ----------------------------------------------------
  // STEP 6: Booking Creation & Booking Fee Payment (₹30)
  // ----------------------------------------------------
  logStep(6, 'Booking Creation & Booking Fee Payment');
  const createOrderRes = await fetch(`${BASE_URL}/bookings/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      staffId: staffId,
      service: 'House Cleaning',
      date: new Date(Date.now() + 86400000).toISOString(),
      timeSlot: '10:00 AM - 12:00 PM',
      location: 'Flat 402, Green Valley Apartments, Sector 45, Gurgaon',
      lat: 28.4595,
      lng: 77.0266,
      notes: 'Please bring eco-friendly cleaning liquids.',
    }),
  });
  const createOrderData = await createOrderRes.json();
  assert(
    createOrderRes.status === 201 && createOrderData.bookingId && createOrderData.razorpayOrderId,
    `Booking order created! Booking #: ${createOrderData.bookingNumber}, Razorpay Order: ${createOrderData.razorpayOrderId}`
  );
  const bookingId = createOrderData.bookingId;
  const rzpOrderId = createOrderData.razorpayOrderId;
  const mockPaymentId = `pay_${Date.now()}`;
  const mockSig = generateRazorpaySig(rzpOrderId, mockPaymentId);

  // Confirm ₹30 payment
  const confirmFeeRes = await fetch(`${BASE_URL}/bookings/confirm-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      bookingId: bookingId,
      razorpayOrderId: rzpOrderId,
      razorpayPaymentId: mockPaymentId,
      razorpaySignature: mockSig,
    }),
  });
  const confirmFeeData = await confirmFeeRes.json();
  assert(
    confirmFeeData.success && confirmFeeData.booking.status === 'requested',
    'Booking fee confirmed! Booking status updated to "requested"'
  );

  // ----------------------------------------------------
  // STEP 7: Staff Accepts Booking & Starts Service
  // ----------------------------------------------------
  logStep(7, 'Staff Accepts Booking & Starts Service');
  // Staff lists incoming bookings
  const staffBookingsRes = await fetch(`${BASE_URL}/bookings/staff?status=pending`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const staffBookingsData = await staffBookingsRes.json();
  assert(
    staffBookingsData.success && staffBookingsData.bookings.some((b) => b._id === bookingId),
    'Staff received incoming booking request in pending tab'
  );

  // Staff Accepts Booking
  const acceptRes = await fetch(`${BASE_URL}/bookings/${bookingId}/accept`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const acceptData = await acceptRes.json();
  assert(acceptData.success && acceptData.booking.status === 'accepted', 'Staff accepted the booking!');

  // Staff Starts Service
  const startRes = await fetch(`${BASE_URL}/bookings/${bookingId}/start`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const startData = await startRes.json();
  assert(startData.success && startData.booking.status === 'ongoing', 'Staff started service! Status: "ongoing"');

  // ----------------------------------------------------
  // STEP 8: Staff Completes Service & Submits Bill
  // ----------------------------------------------------
  logStep(8, 'Staff Completes Service & Submits Bill');
  const completeSvcRes = await fetch(`${BASE_URL}/bookings/${bookingId}/complete`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      serviceCharge: 450,
      additionalCharge: 50, // Total: ₹500
    }),
  });
  const completeSvcData = await completeSvcRes.json();
  assert(
    completeSvcData.success &&
      completeSvcData.booking.status === 'paymentPending' &&
      completeSvcData.booking.totalServiceAmount === 500,
    'Staff completed work & generated bill for ₹500! Status: "paymentPending"'
  );

  // ----------------------------------------------------
  // STEP 9: Customer Wallet Topup & Service Fee Payment
  // ----------------------------------------------------
  logStep(9, 'Customer Wallet Topup & Service Payment');
  // Customer tops up wallet with ₹600
  const topupRzpOrderId = `topup_order_${Date.now()}`;
  const topupPaymentId = `pay_topup_${Date.now()}`;
  const topupSig = generateRazorpaySig(topupRzpOrderId, topupPaymentId);

  const topupRes = await fetch(`${BASE_URL}/wallet/topup-confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      razorpayOrderId: topupRzpOrderId,
      razorpayPaymentId: topupPaymentId,
      razorpaySignature: topupSig,
      amount: 600,
    }),
  });
  const topupData = await topupRes.json();
  assert(topupData.success && topupData.newBalance >= 600, `Customer wallet topped up! New balance: ₹${topupData.newBalance}`);

  // Customer pays ₹500 service fee from wallet
  const paySvcRes = await fetch(`${BASE_URL}/bookings/${bookingId}/pay-service`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      method: 'wallet',
    }),
  });
  const paySvcData = await paySvcRes.json();
  assert(paySvcData.success, 'Customer successfully paid ₹500 service fee via wallet to staff!');

  // ----------------------------------------------------
  // STEP 10: Customer Review & Rating Submission
  // ----------------------------------------------------
  logStep(10, 'Customer Review & Rating');
  const reviewRes = await fetch(`${BASE_URL}/bookings/${bookingId}/complete-booking`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      rating: 5,
      comment: 'Outstanding cleaning service! Highly recommended professional.',
      tags: ['Punctual', 'Polite', 'Great Quality'],
    }),
  });
  const reviewData = await reviewRes.json();
  assert(reviewData.success, 'Review submitted & booking finalized as "completed"!');

  // ----------------------------------------------------
  // STEP 11: Wallet & Earnings Verification
  // ----------------------------------------------------
  logStep(11, 'Audit Wallet Balances & Ledger Transactions');
  
  // Customer Wallet
  const custWalletRes = await fetch(`${BASE_URL}/wallet/balance`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  const custWalletData = await custWalletRes.json();
  console.log(`💳 Customer Remaining Wallet Balance: ₹${custWalletData.balance}`);

  // Staff Wallet & Earnings
  const staffWalletRes = await fetch(`${BASE_URL}/wallet/balance`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  const staffWalletData = await staffWalletRes.json();
  console.log(`💰 Staff Wallet Balance: ₹${staffWalletData.balance} | Total Earnings: ₹${staffWalletData.totalEarnings}`);
  assert(staffWalletData.balance === 500 && staffWalletData.totalEarnings === 500, 'Staff wallet credited ₹500 correctly!');

  // Staff Profile Rating Check
  const staffProfileRes = await fetch(`${BASE_URL}/staff/${staffId}/profile`, {
    headers: { Authorization: `Bearer ${custToken}` },
  });
  const staffProfileData = await staffProfileRes.json();
  console.log(`⭐ Staff Rating: ${staffProfileData.profile.rating} / 5 (${staffProfileData.profile.reviewCount} review)`);
  assert(staffProfileData.profile.rating === 5 && staffProfileData.reviews.length === 1, 'Staff rating updated to 5.0 in database!');

  await mongoose.disconnect();

  console.log(`\n======================================================`);
  console.log(`🎉 ALL 11 E2E INTEGRATION TEST STEPS PASSED SUCCESSFULLY!`);
  console.log(`======================================================\n`);
}

runE2ETest().catch((err) => {
  console.error(`❌ E2E Test Suite Error:`, err);
  process.exit(1);
});
