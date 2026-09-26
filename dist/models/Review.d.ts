import mongoose, { Document } from 'mongoose';
export interface IReview extends Document {
    bookingId: mongoose.Types.ObjectId;
    customerId: mongoose.Types.ObjectId;
    staffId: mongoose.Types.ObjectId;
    rating: number;
    comment?: string;
    tags: string[];
    images: string[];
}
export declare const Review: mongoose.Model<IReview, {}, {}, {}, Document<unknown, {}, IReview, {}, mongoose.DefaultSchemaOptions> & IReview & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IReview>;
