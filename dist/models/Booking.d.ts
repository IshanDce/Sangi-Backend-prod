import mongoose, { Document } from 'mongoose';
export type BookingStatus = 'pendingPayment' | 'paymentSuccess' | 'requested' | 'accepted' | 'declined' | 'cancelled' | 'ongoing' | 'serviceCompleted' | 'paymentPending' | 'paymentCompleted' | 'completed';
export interface IBooking extends Document {
    bookingNumber: string;
    customerId: mongoose.Types.ObjectId;
    staffId: mongoose.Types.ObjectId;
    service: string;
    date: Date;
    timeSlot: string;
    location: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
    notes?: string;
    status: BookingStatus;
    bookingFee: number;
    serviceCharge?: number;
    additionalCharge?: number;
    totalServiceAmount?: number;
    bookingFeePayment?: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        paidAt: Date;
    };
    serviceFeePayment?: {
        razorpayOrderId?: string;
        razorpayPaymentId?: string;
        paidAt?: Date;
        method?: 'wallet' | 'razorpay';
    };
}
export declare const Booking: mongoose.Model<IBooking, {}, {}, {}, Document<unknown, {}, IBooking, {}, mongoose.DefaultSchemaOptions> & IBooking & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBooking>;
