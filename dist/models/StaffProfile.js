"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffProfile = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DayScheduleSchema = new mongoose_1.Schema({
    isAvailable: { type: Boolean, default: true },
    start: { type: String, default: '09:00' },
    end: { type: String, default: '19:00' },
}, { _id: false });
const StaffProfileSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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
    portfolio: [{
            url: { type: String, required: true },
            caption: String,
            uploadedAt: { type: Date, default: Date.now },
        }],
    // No defaults here — `location` is only written when the staff app
    // pushes a real GPS fix. A profile with no location has no `location`
    // key at all (not even `type: "Point"`), so Mongo's 2dsphere index
    // never sees a malformed GeoJSON doc.
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
    },
    lastLocationUpdateAt: { type: Date, default: null },
}, { timestamps: true });
StaffProfileSchema.index({ location: '2dsphere' }, { sparse: true });
exports.StaffProfile = mongoose_1.default.model('StaffProfile', StaffProfileSchema);
//# sourceMappingURL=StaffProfile.js.map