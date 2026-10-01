import mongoose, { Schema, Document } from 'mongoose';

export interface IReferral extends Document {
  referrerId: mongoose.Types.ObjectId;
  refereeId: mongoose.Types.ObjectId;
  referralCode: string;
  rewardAmount: number;
  status: 'pending' | 'completed' | 'failed';
  creditedAt?: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refereeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referralCode: { type: String, required: true },
    rewardAmount: { type: Number, required: true, default: 50 },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    creditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevent duplicate referrals
ReferralSchema.index({ refereeId: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
