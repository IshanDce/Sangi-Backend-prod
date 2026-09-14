"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLogger = exports.locationLogger = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Decode JWT just for logging — auth middleware hasn't run yet at this point
const getUserIdFromReq = (req) => {
    try {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer "))
            return "(no token)";
        const decoded = jsonwebtoken_1.default.decode(auth.split(" ")[1]);
        return decoded?.id ?? "(unknown)";
    }
    catch {
        return "(decode error)";
    }
};
const locationLogger = (req, _res, next) => {
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
exports.locationLogger = locationLogger;
// Optional: log every search so you can see when customer opens services
const searchLogger = (req, _res, next) => {
    if (req.path === "/staff/search") {
        const ts = new Date().toISOString();
        const { service, lat, lng } = req.query;
        console.log(`🔎 [${ts}] STAFF SEARCH — service=${service} lat=${lat} lng=${lng} userId=${getUserIdFromReq(req)}`);
    }
    next();
};
exports.searchLogger = searchLogger;
//# sourceMappingURL=requestLogger.js.map