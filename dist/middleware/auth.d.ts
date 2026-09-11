import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: string;
    };
}
export declare const protect: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (role: 'customer' | 'staff') => (req: AuthRequest, res: Response, next: NextFunction) => void;
