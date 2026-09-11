import mongoose, { Document } from 'mongoose';
export interface ITransaction extends Document {
    userId: mongoose.Types.ObjectId;
    bookingId?: mongoose.Types.ObjectId;
    title: string;
    subtitle?: string;
    amount: number;
    isCredit: boolean;
    type: 'bookingFee' | 'servicePayment' | 'walletTopup' | 'refund' | 'withdrawal' | 'adjustment';
    status: 'pending' | 'completed' | 'failed';
    razorpayRef?: string;
}
export declare const Transaction: mongoose.Model<ITransaction, {}, {}, {}, Document<unknown, {}, ITransaction, {}, mongoose.DefaultSchemaOptions> & ITransaction & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ITransaction>;
