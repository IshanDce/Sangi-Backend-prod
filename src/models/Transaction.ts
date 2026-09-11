import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  title: string;
  subtitle?: string;
  amount: number;
  isCredit: boolean;
  type: 'bookingFee'|'servicePayment'|'walletTopup'|'refund'|'withdrawal'|'adjustment';
  status: 'pending'|'completed'|'failed';
  razorpayRef?: string;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    title: { type: String, required: true },
    subtitle: String,
    amount: { type: Number, required: true },
    isCredit: { type: Boolean, required: true },
    type: { type: String, enum: ['bookingFee','servicePayment','walletTopup','refund','withdrawal','adjustment'], required: true },
    status: { type: String, enum: ['pending','completed','failed'], default: 'completed' },
    razorpayRef: String,
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
