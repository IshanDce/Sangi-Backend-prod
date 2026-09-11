import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
export declare const getBalance: (req: AuthRequest, res: Response) => Promise<void>;
export declare const getTransactions: (req: AuthRequest, res: Response) => Promise<void>;
export declare const createTopupOrder: (req: AuthRequest, res: Response) => Promise<void>;
export declare const confirmTopup: (req: AuthRequest, res: Response) => Promise<void>;
export declare const withdraw: (req: AuthRequest, res: Response) => Promise<void>;
