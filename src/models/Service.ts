import mongoose, { Schema, Document } from 'mongoose';

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

const ServiceSchema = new Schema<IService>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true, trim: true },
    bookingFee: { type: Number, required: true, default: 30 },
    basePrice: { type: Number, required: true, default: 299 },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Service = mongoose.model<IService>('Service', ServiceSchema);
