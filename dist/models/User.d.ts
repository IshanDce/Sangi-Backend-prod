import mongoose, { Document } from 'mongoose';
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
    comparePassword(pw: string): Promise<boolean>;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, Document<unknown, {}, IUser, {}, mongoose.DefaultSchemaOptions> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IUser>;
