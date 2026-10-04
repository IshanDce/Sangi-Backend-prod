import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };

    // Check if user is blocked (skip check for admin role)
    if (decoded.role !== 'admin') {
      const userDoc = await User.findById(decoded.id).select('isBlocked blockReason');
      if (userDoc?.isBlocked) {
        res.status(403).json({
          success: false,
          isBlocked: true,
          message: userDoc.blockReason
            ? `Your account has been blocked: ${userDoc.blockReason}`
            : 'Your account has been blocked by administrator.',
        });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

export const requireRole = (...roles: Array<'customer' | 'staff' | 'admin'>) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as any)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
    return;
  }
  next();
};
