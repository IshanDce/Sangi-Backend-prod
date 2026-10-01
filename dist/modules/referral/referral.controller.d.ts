import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
export declare const getMyReferral: (req: AuthRequest, res: Response) => Promise<void>;
export declare const validateReferralCode: (req: Request, res: Response) => Promise<void>;
