import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
export declare const getMe: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateMe: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updatePhoto: (req: AuthRequest, res: Response) => Promise<void>;
export declare const updateFcmToken: (req: AuthRequest, res: Response) => Promise<void>;
