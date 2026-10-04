import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'customer' | 'staff' | 'admin';
  profilePhotoUrl?: string;
  isPhoneVerified: boolean;
  fcmToken?: string;
  walletBalance: number;
  // ─── Customer live location (updated by app every 3 min) ───
  lastKnownLat?: number;
  lastKnownLng?: number;
  lastLocationUpdateAt?: Date;
  // ─── Referral system ───
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  referralCount: number;
  // ─── Admin Controls ───
  isBlocked: boolean;
  blockReason?: string;
  blockedAt?: Date;
  // ─── Bank / Payout details ───
  bankAccount?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    upiId?: string;
  };
  comparePassword(pw: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'staff', 'admin'], required: true },
    profilePhotoUrl: { type: String, default: null },
    isPhoneVerified: { type: Boolean, default: false },
    fcmToken: { type: String, default: null },
    walletBalance: { type: Number, default: 0 },
    lastKnownLat: { type: Number, default: null },
    lastKnownLng: { type: Number, default: null },
    lastLocationUpdateAt: { type: Date, default: null },
    // ─── Referral system ───
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    referralCount: { type: Number, default: 0 },
    // ─── Admin Controls ───
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: null },
    blockedAt: { type: Date, default: null },
    // ─── Bank details ───
    bankAccount: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      upiId: String,
    },
  },
  { timestamps: true }
);

// Auto-generate unique referral code on user creation
UserSchema.pre('save', async function () {
  if (!this.isNew || this.referralCode) return;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let exists = true;
  while (exists) {
    code = 'SANGI-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    exists = !!(await mongoose.model('User').findOne({ referralCode: code }));
  }
  this.referralCode = code;
});

UserSchema.methods.comparePassword = async function (pw: string) {
  return bcrypt.compare(pw, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
