// Lightweight request logger — prints location pings to stdout with timestamp
// so you can watch live updates in the AWS console / pm2 logs.
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Decode JWT just for logging — auth middleware hasn't run yet at this point
const getUserIdFromReq = (req: Request): string => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return "(no token)";
    const decoded = jwt.decode(auth.split(" ")[1]) as any;
    return decoded?.id ?? "(unknown)";
  } catch {
    return "(decode error)";
  }
};

export const locationLogger = (req: Request, _res: Response, next: NextFunction) => {
  const ts = new Date().toISOString();

  // Staff location push
  if (req.method === "PUT" && req.path === "/staff/me/location") {
    const userId = getUserIdFromReq(req);
    console.log(`📍 [${ts}] STAFF LOCATION PUSH — userId=${userId} lat=${req.body?.lat} lng=${req.body?.lng}`);
  }

  // Customer location push
  if (req.method === "PUT" && req.path === "/users/me/location") {
    const userId = getUserIdFromReq(req);
    console.log(`📍 [${ts}] CUSTOMER LOCATION PUSH — userId=${userId} lat=${req.body?.lat} lng=${req.body?.lng}`);
  }

  // Customer fetching their own location (debug helper)
  if (req.method === "GET" && req.path === "/users/me/location") {
    console.log(`🔍 [${ts}] CUSTOMER LOCATION FETCH — userId=${getUserIdFromReq(req)}`);
  }

  next();
};

// Optional: log every search so you can see when customer opens services
export const searchLogger = (req: Request, _res: Response, next: NextFunction) => {
  if (req.path === "/staff/search") {
    const ts = new Date().toISOString();
    const { service, lat, lng } = req.query;
    console.log(`🔎 [${ts}] STAFF SEARCH — service=${service} lat=${lat} lng=${lng} userId=${getUserIdFromReq(req)}`);
  }
  next();
};