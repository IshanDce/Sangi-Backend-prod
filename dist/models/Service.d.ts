import mongoose, { Document } from 'mongoose';
export interface IService extends Document {
    slug: string;
    name: string;
    category: string;
    imageUrl: string;
    bookingFee: number;
    basePrice: number;
    description?: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Service: mongoose.Model<IService, {}, {}, {}, Document<unknown, {}, IService, {}, mongoose.DefaultSchemaOptions> & IService & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IService>;
