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
exports.Booking = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// nanoid v3 - CJS compatible
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);
const BookingSchema = new mongoose_1.Schema({
    bookingNumber: { type: String, unique: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    staffId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: String, required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    location: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    notes: String,
    status: {
        type: String,
        enum: ['pendingPayment', 'paymentSuccess', 'requested', 'accepted', 'declined', 'cancelled', 'ongoing', 'serviceCompleted', 'paymentPending', 'paymentCompleted', 'completed'],
        default: 'pendingPayment',
    },
    bookingFee: { type: Number, default: 30 },
    serviceCharge: Number,
    additionalCharge: Number,
    totalServiceAmount: Number,
    bookingFeePayment: { razorpayOrderId: String, razorpayPaymentId: String, paidAt: Date },
    serviceFeePayment: { razorpayOrderId: String, razorpayPaymentId: String, paidAt: Date, method: { type: String, enum: ['wallet', 'razorpay'] } },
}, { timestamps: true });
BookingSchema.pre('save', function () {
    if (!this.bookingNumber) {
        this.bookingNumber = `BK${nanoid()}`;
    }
});
exports.Booking = mongoose_1.default.model('Booking', BookingSchema);
//# sourceMappingURL=Booking.js.map