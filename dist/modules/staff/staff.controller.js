"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMyLocation = exports.updateBankAccount = exports.updateMyAvailability = exports.updateMyServices = exports.updateMyProfile = exports.getStaffProfile = exports.searchStaff = exports.registerStep4Kyc = exports.registerStep3Availability = exports.registerStep2Services = exports.registerStep1 = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../../models/User");
const StaffProfile_1 = require("../../models/StaffProfile");
const Review_1 = require("../../models/Review");
const imagekit_1 = require("../../config/imagekit");
// ─── Step 1: POST /api/v1/staff/register/step1
const registerStep1 = async (req, res) => {
    try {
        const { fullName, email, phone, password, experience, about } = req.body;
        const existing = await User_1.User.findOne({ $or: [{ phone }, { email }] });
        if (existing) {
            res.status(409).json({ success: false, message: "Phone or email already registered" });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await User_1.User.create({ fullName, email, phone, passwordHash, role: "staff" });
        // No default coords — staff must push real GPS to appear in search
        const staffProfile = await StaffProfile_1.StaffProfile.create({ userId: user._id, experience, about });
        res.status(201).json({ success: true, message: "Step 1 complete. Verify OTP.", userId: user._id, staffProfileId: staffProfile._id });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.registerStep1 = registerStep1;
// ─── Step 2: PUT /api/v1/staff/register/step2-services
const registerStep2Services = async (req, res) => {
    try {
        const { services } = req.body;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { services }, { new: true });
        res.json({ success: true, staffProfile: profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.registerStep2Services = registerStep2Services;
// ─── Step 3: PUT /api/v1/staff/register/step3-availability
const registerStep3Availability = async (req, res) => {
    try {
        const { availability } = req.body;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { availability }, { new: true });
        res.json({ success: true, staffProfile: profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.registerStep3Availability = registerStep3Availability;
// ─── Step 4: POST /api/v1/staff/register/step4-kyc  (multipart: aadhaarFront, aadhaarBack, panCard)
const registerStep4Kyc = async (req, res) => {
    try {
        const files = req.files;
        const uploadFile = async (file, folder, name) => {
            const b64 = file.buffer.toString("base64");
            const r = await imagekit_1.imagekit.upload({ file: b64, fileName: `${name}_${req.user.id}_${Date.now()}.jpg`, folder });
            return r.url;
        };
        const aadhaarFrontUrl = files.aadhaarFront ? await uploadFile(files.aadhaarFront[0], "/sangi/kyc/aadhaar/", "aadhaar_front") : undefined;
        const aadhaarBackUrl = files.aadhaarBack ? await uploadFile(files.aadhaarBack[0], "/sangi/kyc/aadhaar/", "aadhaar_back") : undefined;
        const panCardUrl = files.panCard ? await uploadFile(files.panCard[0], "/sangi/kyc/pan/", "pan") : undefined;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { kycStatus: "pending", "kyc.aadhaarFrontUrl": aadhaarFrontUrl, "kyc.aadhaarBackUrl": aadhaarBackUrl, "kyc.panCardUrl": panCardUrl }, { new: true });
        res.json({ success: true, kycStatus: "pending", staffProfile: profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.registerStep4Kyc = registerStep4Kyc;
// ─── GET /api/v1/staff/search?service=X&lat=Y&lng=Z
// Falls back to caller's last-known location (lastLocationUpdateAt < 30 min ago)
// if lat/lng are not provided in the query — keeps the km shown in customer app accurate.
const searchStaff = async (req, res) => {
    try {
        const { service, lat, lng } = req.query;
        const matchStage = { kycStatus: { $in: ["approved", "pending", "not_submitted"] } };
        if (service)
            matchStage.services = service;
        // ─── Resolve origin coordinates ───
        let latitude;
        let longitude;
        if (lat && lng) {
            const parsedLat = parseFloat(lat);
            const parsedLng = parseFloat(lng);
            if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
                latitude = parsedLat;
                longitude = parsedLng;
            }
        }
        // Fallback to caller's stored last-known location if query is missing or stale
        if ((latitude === undefined || longitude === undefined) && req.user?.id) {
            const caller = await User_1.User.findById(req.user.id).select("lastKnownLat lastKnownLng lastLocationUpdateAt");
            if (caller?.lastKnownLat != null && caller?.lastKnownLng != null) {
                const ageMs = caller.lastLocationUpdateAt
                    ? Date.now() - new Date(caller.lastLocationUpdateAt).getTime()
                    : Infinity;
                const STALE_MS = 30 * 60 * 1000; // 30 min
                if (ageMs < STALE_MS) {
                    latitude = caller.lastKnownLat;
                    longitude = caller.lastKnownLng;
                }
            }
        }
        let staffProfiles;
        if (latitude !== undefined && longitude !== undefined) {
            const MAX_DISTANCE_METERS = 10000; // 10km
            const STALE_MS = 30 * 60 * 1000; // 30 min — staff must have pushed location recently
            const freshEnough = new Date(Date.now() - STALE_MS);
            // Build match stage including service filter AND require a recent real
            // location push — profiles still sitting on default coords or with no
            // GPS update at all are excluded so customers don't see fake distances.
            const geoMatch = {
                ...matchStage,
                lastLocationUpdateAt: { $gte: freshEnough },
                location: { $exists: true, $ne: null },
            };
            staffProfiles = await StaffProfile_1.StaffProfile.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [longitude, latitude] },
                        distanceField: "distMeters",
                        maxDistance: MAX_DISTANCE_METERS,
                        spherical: true,
                        query: geoMatch,
                    },
                },
                { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "userInfo" } },
                { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: false } },
                {
                    $project: {
                        _id: "$userInfo._id",
                        fullName: "$userInfo.fullName",
                        profilePhotoUrl: "$userInfo.profilePhotoUrl",
                        title: 1,
                        rating: 1,
                        reviewCount: 1,
                        services: 1,
                        about: 1,
                        experience: 1,
                        isKycVerified: 1,
                        distanceKm: { $divide: ["$distMeters", 1000] },
                    },
                },
            ]);
        }
        else {
            // No customer coords → list KYC-approved staff with a recent location
            // (still ranked without distance so the UI can show "—")
            const STALE_MS = 30 * 60 * 1000;
            const freshEnough = new Date(Date.now() - STALE_MS);
            const profiles = await StaffProfile_1.StaffProfile.find({
                ...matchStage,
                lastLocationUpdateAt: { $gte: freshEnough },
                location: { $exists: true, $ne: null },
            })
                .populate("userId", "fullName profilePhotoUrl")
                .limit(50);
            staffProfiles = profiles.map((p) => {
                const user = p.userId;
                return {
                    _id: user._id,
                    fullName: user.fullName,
                    profilePhotoUrl: user.profilePhotoUrl,
                    title: p.title,
                    rating: p.rating,
                    reviewCount: p.reviewCount,
                    services: p.services,
                    about: p.about,
                    experience: p.experience,
                    isKycVerified: p.isKycVerified,
                    distanceKm: null,
                };
            });
        }
        res.json({ success: true, staff: staffProfiles });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.searchStaff = searchStaff;
// ─── GET /api/v1/staff/:staffId/profile
const getStaffProfile = async (req, res) => {
    try {
        const profile = await StaffProfile_1.StaffProfile.findOne({ userId: req.params.staffId }).populate("userId", "fullName profilePhotoUrl");
        if (!profile) {
            res.status(404).json({ success: false, message: "Staff not found" });
            return;
        }
        const reviews = await Review_1.Review.find({ staffId: req.params.staffId })
            .populate("customerId", "fullName profilePhotoUrl")
            .sort({ createdAt: -1 })
            .limit(10);
        res.json({ success: true, profile, reviews });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getStaffProfile = getStaffProfile;
// ─── PUT /api/v1/staff/me/profile
const updateMyProfile = async (req, res) => {
    try {
        const { title, about, serviceArea } = req.body;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { title, about, serviceArea }, { new: true });
        res.json({ success: true, profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateMyProfile = updateMyProfile;
// ─── PUT /api/v1/staff/me/services
const updateMyServices = async (req, res) => {
    try {
        const { services } = req.body;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { services }, { new: true });
        res.json({ success: true, profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateMyServices = updateMyServices;
// ─── PUT /api/v1/staff/me/availability
const updateMyAvailability = async (req, res) => {
    try {
        const { availability } = req.body;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { availability }, { new: true });
        res.json({ success: true, profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateMyAvailability = updateMyAvailability;
// ─── PUT /api/v1/staff/me/bank-account
const updateBankAccount = async (req, res) => {
    try {
        const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
        const profile = await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, { bankAccount: { accountHolderName, accountNumber, ifscCode, bankName } }, { new: true });
        res.json({ success: true, profile });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateBankAccount = updateBankAccount;
// ─── PUT /api/v1/staff/me/location  (called by app every 3 min)
const updateMyLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (lat === undefined || lng === undefined) {
            res.status(400).json({ success: false, message: "lat and lng are required" });
            return;
        }
        await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: req.user.id }, {
            location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
            lastLocationUpdateAt: new Date(),
        }, { new: true });
        res.json({ success: true, message: "Location updated" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateMyLocation = updateMyLocation;
//# sourceMappingURL=staff.controller.js.map