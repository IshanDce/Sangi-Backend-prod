import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import { StaffProfile } from "../../models/StaffProfile";
import { Review } from "../../models/Review";
import { AuthRequest } from "../../middleware/auth";
import { imagekit } from "../../config/imagekit";

// ─── Step 1: POST /api/v1/staff/register/step1
export const registerStep1 = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, password, experience, about } = req.body;
    const existing = await User.findOne({ $or: [{ phone }, { email }] });
    if (existing) { res.status(409).json({ success: false, message: "Phone or email already registered" }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, email, phone, passwordHash, role: "staff" });
    // No default coords — staff must push real GPS to appear in search
    const staffProfile = await StaffProfile.create({ userId: user._id, experience, about });

    res.status(201).json({ success: true, message: "Step 1 complete. Verify OTP.", userId: user._id, staffProfileId: staffProfile._id });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── Step 2: PUT /api/v1/staff/register/step2-services
export const registerStep2Services = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { services } = req.body;
    const profile = await StaffProfile.findOneAndUpdate(
      { userId: req.user!.id },
      { services },
      { new: true }
    );
    res.json({ success: true, staffProfile: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── Step 3: PUT /api/v1/staff/register/step3-availability
export const registerStep3Availability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { availability } = req.body;
    const profile = await StaffProfile.findOneAndUpdate(
      { userId: req.user!.id },
      { availability },
      { new: true }
    );
    res.json({ success: true, staffProfile: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── Step 4: POST /api/v1/staff/register/step4-kyc  (multipart: aadhaarFront, aadhaarBack, panCard)
export const registerStep4Kyc = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const uploadFile = async (file: Express.Multer.File, folder: string, name: string) => {
      const b64 = file.buffer.toString("base64");
      const r = await imagekit.upload({ file: b64, fileName: `${name}_${req.user!.id}_${Date.now()}.jpg`, folder });
      return r.url;
    };

    const aadhaarFrontUrl = files.aadhaarFront ? await uploadFile(files.aadhaarFront[0], "/sangi/kyc/aadhaar/", "aadhaar_front") : undefined;
    const aadhaarBackUrl = files.aadhaarBack ? await uploadFile(files.aadhaarBack[0], "/sangi/kyc/aadhaar/", "aadhaar_back") : undefined;
    const panCardUrl = files.panCard ? await uploadFile(files.panCard[0], "/sangi/kyc/pan/", "pan") : undefined;

    const profile = await StaffProfile.findOneAndUpdate(
      { userId: req.user!.id },
      { kycStatus: "pending", "kyc.aadhaarFrontUrl": aadhaarFrontUrl, "kyc.aadhaarBackUrl": aadhaarBackUrl, "kyc.panCardUrl": panCardUrl },
      { new: true }
    );
    res.json({ success: true, kycStatus: "pending", staffProfile: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── GET /api/v1/staff/search?service=X&lat=Y&lng=Z
// Falls back to caller's last-known location (lastLocationUpdateAt < 30 min ago)
// if lat/lng are not provided in the query — keeps the km shown in customer app accurate.
export const searchStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const { service, lat, lng } = req.query;
    const matchStage: Record<string, unknown> = { kycStatus: { $in: ["approved", "pending", "not_submitted"] } };
    if (service) matchStage.services = service;

    // ─── Resolve origin coordinates ───
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (lat && lng) {
      const parsedLat = parseFloat(lat as string);
      const parsedLng = parseFloat(lng as string);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        latitude = parsedLat;
        longitude = parsedLng;
      }
    }

    // Fallback to caller's stored last-known location if query is missing or stale
    if ((latitude === undefined || longitude === undefined) && (req as any).user?.id) {
      const caller = await User.findById((req as any).user.id).select(
        "lastKnownLat lastKnownLng lastLocationUpdateAt"
      );
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

    let staffProfiles: any[];

    if (latitude !== undefined && longitude !== undefined) {
      const MAX_DISTANCE_METERS = 10000; // 10km
      const STALE_MS = 30 * 60 * 1000; // 30 min — staff must have pushed location recently
      const freshEnough = new Date(Date.now() - STALE_MS);

      // Build match stage including service filter AND require a recent real
      // location push — profiles still sitting on default coords or with no
      // GPS update at all are excluded so customers don't see fake distances.
      const geoMatch: Record<string, unknown> = {
        ...matchStage,
        lastLocationUpdateAt: { $gte: freshEnough },
        location: { $exists: true, $ne: null },
      };

      staffProfiles = await StaffProfile.aggregate([
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
            serviceArea: 1,
            availability: 1,
            isKycVerified: { $eq: ["$kycStatus", "approved"] },
            kycStatus: 1,
            distanceKm: { $divide: ["$distMeters", 1000] },
          },
        },
      ]);
    } else {
      // No customer coords → list KYC-approved staff with a recent location
      // (still ranked without distance so the UI can show "—")
      const STALE_MS = 30 * 60 * 1000;
      const freshEnough = new Date(Date.now() - STALE_MS);

      const profiles = await StaffProfile.find({
        ...matchStage,
        lastLocationUpdateAt: { $gte: freshEnough },
        location: { $exists: true, $ne: null },
      })
        .populate("userId", "fullName profilePhotoUrl")
        .limit(50);

      staffProfiles = profiles.map((p) => {
        const user = p.userId as unknown as { _id: string; fullName: string; profilePhotoUrl?: string };
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
          serviceArea: p.serviceArea,
          availability: p.availability,
          isKycVerified: p.kycStatus === "approved",
          kycStatus: p.kycStatus,
          distanceKm: null,
        };
      });
    }

    res.json({ success: true, staff: staffProfiles });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── GET /api/v1/staff/:staffId/profile
export const getStaffProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await StaffProfile.findOne({ userId: req.params.staffId }).populate("userId", "fullName profilePhotoUrl");
    if (!profile) { res.status(404).json({ success: false, message: "Staff not found" }); return; }

    const reviews = await Review.find({ staffId: req.params.staffId })
      .populate("customerId", "fullName profilePhotoUrl")
      .sort({ createdAt: -1 })
      .limit(10);

    // Flatten for the customer app — populate userId and derive isKycVerified
    const profileObj = profile.toObject() as unknown as Record<string, unknown>;
    const userObj = profileObj.userId as Record<string, unknown> | undefined;
    const flatProfile = {
      ...profileObj,
      fullName: userObj?.fullName,
      profilePhotoUrl: userObj?.profilePhotoUrl,
      isKycVerified: profileObj.kycStatus === "approved",
    };

    res.json({ success: true, profile: flatProfile, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── GET /api/v1/staff/me/profile  (staff sees their own full profile for editing)
export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await StaffProfile.findOne({ userId: req.user!.id }).populate("userId", "fullName profilePhotoUrl email phone");
    if (!profile) { res.status(404).json({ success: false, message: "Staff profile not found" }); return; }

    const profileObj = profile.toObject() as unknown as Record<string, unknown>;
    const userObj = profileObj.userId as Record<string, unknown> | undefined;
    const flatProfile = {
      ...profileObj,
      fullName: userObj?.fullName,
      profilePhotoUrl: userObj?.profilePhotoUrl,
      email: userObj?.email,
      phone: userObj?.phone,
      isKycVerified: profileObj.kycStatus === "approved",
    };

    res.json({ success: true, profile: flatProfile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};


export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, about, serviceArea } = req.body;
    const profile = await StaffProfile.findOneAndUpdate({ userId: req.user!.id }, { title, about, serviceArea }, { new: true });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── PUT /api/v1/staff/me/services
export const updateMyServices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { services } = req.body;
    const profile = await StaffProfile.findOneAndUpdate({ userId: req.user!.id }, { services }, { new: true });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── PUT /api/v1/staff/me/availability
export const updateMyAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { availability } = req.body;
    const profile = await StaffProfile.findOneAndUpdate({ userId: req.user!.id }, { availability }, { new: true });
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── PUT /api/v1/staff/me/bank-account
export const updateBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;
    const profile = await StaffProfile.findOneAndUpdate(
      { userId: req.user!.id },
      { bankAccount: { accountHolderName, accountNumber, ifscCode, bankName } },
      { new: true }
    );
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── PUT /api/v1/staff/me/location  (called by app every 3 min)
export const updateMyLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      res.status(400).json({ success: false, message: "lat and lng are required" });
      return;
    }
    await StaffProfile.findOneAndUpdate(
      { userId: req.user!.id },
      {
        location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        lastLocationUpdateAt: new Date(),
      },
      { new: true }
    );
    res.json({ success: true, message: "Location updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};
