import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
export declare const getNotifications: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markRead: (req: AuthRequest, res: Response) => Promise<void>;
export declare const markAllRead: (req: AuthRequest, res: Response) => Promise<void>;
