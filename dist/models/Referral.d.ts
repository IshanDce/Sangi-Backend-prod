import mongoose, { Document } from 'mongoose';
export interface IReferral extends Document {
    referrerId: mongoose.Types.ObjectId;
    refereeId: mongoose.Types.ObjectId;
    referralCode: string;
    rewardAmount: number;
    status: 'pending' | 'completed' | 'failed';
    creditedAt?: Date;
}
export declare const Referral: mongoose.Model<IReferral, {}, {}, {}, Document<unknown, {}, IReferral, {}, mongoose.DefaultSchemaOptions> & IReferral & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IReferral>;
