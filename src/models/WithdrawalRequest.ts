import mongoose, { Schema, Document } from 'mongoose';
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export interface IWithdrawalRequest extends Document {
  withdrawalNumber: string;
  userId: mongoose.Types.ObjectId;
  userRole: 'customer' | 'staff' | 'admin';
  amount: number;
  payoutMethod: 'bank' | 'upi';
  accountDetails: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  utrReference?: string;
  rejectionReason?: string;
  adminNotes?: string;
  processedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    withdrawalNumber: { type: String, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: ['customer', 'staff', 'admin'], required: true },
    amount: { type: Number, required: true, min: 100 },
    payoutMethod: { type: String, enum: ['bank', 'upi'], default: 'bank' },
    accountDetails: {
      bankName: String,
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      upiId: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    utrReference: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    adminNotes: { type: String, default: null },
    processedAt: { type: Date, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

WithdrawalRequestSchema.pre('save', function () {
  if (!this.withdrawalNumber) {
    this.withdrawalNumber = `WTH-${nanoid()}`;
  }
});

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);
