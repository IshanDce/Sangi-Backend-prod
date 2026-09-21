import mongoose, { Document } from 'mongoose';
export interface IOtp extends Document {
    phone: string;
    otp: string;
    purpose: 'register' | 'login' | 'forgot_password';
    expiresAt: Date;
}
export declare const Otp: mongoose.Model<IOtp, {}, {}, {}, Document<unknown, {}, IOtp, {}, mongoose.DefaultSchemaOptions> & IOtp & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IOtp>;
