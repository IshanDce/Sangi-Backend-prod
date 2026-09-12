import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: 'customer' | 'staff';
  profilePhotoUrl?: string;
  isPhoneVerified: boolean;
  fcmToken?: string;
  walletBalance: number;
  // ─── Customer live location (updated by app every 3 min) ───
  lastKnownLat?: number;
  lastKnownLng?: number;
  lastLocationUpdateAt?: Date;
  comparePassword(pw: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'staff'], required: true },
    profilePhotoUrl: { type: String, default: null },
    isPhoneVerified: { type: Boolean, default: false },
    fcmToken: { type: String, default: null },
    walletBalance: { type: Number, default: 0 },
    lastKnownLat: { type: Number, default: null },
    lastKnownLng: { type: Number, default: null },
    lastLocationUpdateAt: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (pw: string) {
  return bcrypt.compare(pw, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
