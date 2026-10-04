import mongoose, { Document } from 'mongoose';
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
export declare const WithdrawalRequest: mongoose.Model<IWithdrawalRequest, {}, {}, {}, Document<unknown, {}, IWithdrawalRequest, {}, mongoose.DefaultSchemaOptions> & IWithdrawalRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IWithdrawalRequest>;
