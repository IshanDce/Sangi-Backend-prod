import mongoose, { Document } from 'mongoose';
export interface IStaffProfile extends Document {
    userId: mongoose.Types.ObjectId;
    title?: string;
    about?: string;
    experience?: string;
    services: string[];
    serviceArea?: string;
    rating: number;
    reviewCount: number;
    isKycVerified: boolean;
    kycStatus: 'not_submitted' | 'pending' | 'approved' | 'rejected';
    kyc: {
        aadhaarFrontUrl?: string;
        aadhaarBackUrl?: string;
        panCardUrl?: string;
        rejectionReason?: string;
    };
    availability: {
        monday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
        tuesday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
        wednesday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
        thursday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
        friday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
        saturday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
        sunday: {
            isAvailable: boolean;
            start: string;
            end: string;
        };
    };
    bankAccount: {
        accountHolderName?: string;
        accountNumber?: string;
        ifscCode?: string;
        bankName?: string;
    };
    location?: {
        type: string;
        coordinates: number[];
    };
}
export declare const StaffProfile: mongoose.Model<IStaffProfile, {}, {}, {}, Document<unknown, {}, IStaffProfile, {}, mongoose.DefaultSchemaOptions> & IStaffProfile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IStaffProfile>;
