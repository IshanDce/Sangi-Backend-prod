import mongoose, { Schema, Document } from 'mongoose';

const DayScheduleSchema = new Schema({
  isAvailable: { type: Boolean, default: true },
  start: { type: String, default: '09:00' },
  end: { type: String, default: '19:00' },
}, { _id: false });

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
    monday: { isAvailable: boolean; start: string; end: string };
    tuesday: { isAvailable: boolean; start: string; end: string };
    wednesday: { isAvailable: boolean; start: string; end: string };
    thursday: { isAvailable: boolean; start: string; end: string };
    friday: { isAvailable: boolean; start: string; end: string };
    saturday: { isAvailable: boolean; start: string; end: string };
    sunday: { isAvailable: boolean; start: string; end: string };
  };
  bankAccount: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  };
  // Live location — only set when staff app pushes real GPS.
  // Schema has NO default coords so a profile without a real push has
  // `location: undefined` and is naturally excluded from nearby search.
  location?: { type: string; coordinates: number[] };
  lastLocationUpdateAt?: Date;
}

const StaffProfileSchema = new Schema<IStaffProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    title: String,
    about: String,
    experience: String,
    services: [{ type: String }],
    serviceArea: String,
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isKycVerified: { type: Boolean, default: false },
    kycStatus: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
    kyc: {
      aadhaarFrontUrl: String,
      aadhaarBackUrl: String,
      panCardUrl: String,
      rejectionReason: String,
    },
    availability: {
      monday: { type: DayScheduleSchema, default: { isAvailable: true, start: '09:00', end: '19:00' } },
      tuesday: { type: DayScheduleSchema, default: { isAvailable: true, start: '09:00', end: '19:00' } },
      wednesday: { type: DayScheduleSchema, default: { isAvailable: true, start: '09:00', end: '19:00' } },
      thursday: { type: DayScheduleSchema, default: { isAvailable: true, start: '09:00', end: '19:00' } },
      friday: { type: DayScheduleSchema, default: { isAvailable: true, start: '09:00', end: '19:00' } },
      saturday: { type: DayScheduleSchema, default: { isAvailable: true, start: '10:00', end: '17:00' } },
      sunday: { type: DayScheduleSchema, default: { isAvailable: false, start: '', end: '' } },
    },
    bankAccount: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
    },
    lastLocationUpdateAt: { type: Date, default: null },
  },
  { timestamps: true }
);

StaffProfileSchema.index({ location: '2dsphere' }, { sparse: true });

export const StaffProfile = mongoose.model<IStaffProfile>('StaffProfile', StaffProfileSchema);
