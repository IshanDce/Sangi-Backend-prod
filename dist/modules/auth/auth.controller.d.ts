import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
export declare const sendOtp: (req: Request, res: Response) => Promise<void>;
export declare const verifyOtp: (req: Request, res: Response) => Promise<void>;
export declare const login: (req: Request, res: Response) => Promise<void>;
export declare const registerCustomer: (req: Request, res: Response) => Promise<void>;
export declare const verifyForgotOtp: (req: Request, res: Response) => Promise<void>;
export declare const resetPassword: (req: Request, res: Response) => Promise<void>;
export declare const logout: (_req: AuthRequest, res: Response) => Promise<void>;
