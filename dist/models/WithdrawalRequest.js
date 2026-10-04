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
exports.WithdrawalRequest = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);
const WithdrawalRequestSchema = new mongoose_1.Schema({
    withdrawalNumber: { type: String, unique: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    userRole: { type: String, enum: ['customer', 'staff', 'admin'], required: true },
    amount: { type: Number, required: true, min: 100 },
    payoutMethod: { type: String, enum: ['bank', 'upi'], default: 'bank' },
    accountDetails: {
        bankName: String,
        accountHolderName: String,
        accountNumber: String,
        ifscCode: String,
        upiId: String,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    utrReference: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    adminNotes: { type: String, default: null },
    processedAt: { type: Date, default: null },
    processedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });
WithdrawalRequestSchema.pre('save', function () {
    if (!this.withdrawalNumber) {
        this.withdrawalNumber = `WTH-${nanoid()}`;
    }
});
exports.WithdrawalRequest = mongoose_1.default.model('WithdrawalRequest', WithdrawalRequestSchema);
//# sourceMappingURL=WithdrawalRequest.js.map