import mongoose, { Schema, Document } from 'mongoose';
// nanoid v3 - CJS compatible
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

export type BookingStatus =
  | 'pendingPayment' | 'paymentSuccess' | 'requested' | 'accepted'
  | 'declined' | 'cancelled' | 'ongoing' | 'serviceCompleted'
  | 'paymentPending' | 'paymentCompleted' | 'completed';

export interface IBooking extends Document {
  bookingNumber: string;
  customerId: mongoose.Types.ObjectId;
  staffId: mongoose.Types.ObjectId;
  service: string;
  date: Date;
  timeSlot: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  notes?: string;
  status: BookingStatus;
  bookingFee: number;
  serviceCharge?: number;
  additionalCharge?: number;
  totalServiceAmount?: number;
  bookingFeePayment?: { razorpayOrderId: string; razorpayPaymentId: string; paidAt: Date };
  serviceFeePayment?: { razorpayOrderId?: string; razorpayPaymentId?: string; paidAt?: Date; method?: 'wallet' | 'razorpay' };
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingNumber: { type: String, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: String, required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    location: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    notes: String,
    status: {
      type: String,
      enum: ['pendingPayment','paymentSuccess','requested','accepted','declined','cancelled','ongoing','serviceCompleted','paymentPending','paymentCompleted','completed'],
      default: 'pendingPayment',
    },
    bookingFee: { type: Number, default: 30 },
    serviceCharge: Number,
    additionalCharge: Number,
    totalServiceAmount: Number,
    bookingFeePayment: { razorpayOrderId: String, razorpayPaymentId: String, paidAt: Date },
    serviceFeePayment: { razorpayOrderId: String, razorpayPaymentId: String, paidAt: Date, method: { type: String, enum: ['wallet','razorpay'] } },
  },
  { timestamps: true }
);

BookingSchema.pre('save', function () {
  if (!this.bookingNumber) {
    this.bookingNumber = `BK${nanoid()}`;
  }
});

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);


