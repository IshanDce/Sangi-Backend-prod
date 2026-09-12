"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLogger = exports.locationLogger = void 0;
const locationLogger = (req, _res, next) => {
    const ts = new Date().toISOString();
    // Staff location push
    if (req.method === "PUT" && req.path === "/staff/me/location") {
        console.log(`📍 [${ts}] STAFF LOCATION PUSH — userId=${req.user?.id} lat=${req.body?.lat} lng=${req.body?.lng}`);
    }
    // Customer location push
    if (req.method === "PUT" && req.path === "/users/me/location") {
        console.log(`📍 [${ts}] CUSTOMER LOCATION PUSH — userId=${req.user?.id} lat=${req.body?.lat} lng=${req.body?.lng}`);
    }
    // Customer fetching their own location (debug helper)
    if (req.method === "GET" && req.path === "/users/me/location") {
        console.log(`🔍 [${ts}] CUSTOMER LOCATION FETCH — userId=${req.user?.id}`);
    }
    next();
};
exports.locationLogger = locationLogger;
// Optional: log every search so you can see when customer opens services
const searchLogger = (req, _res, next) => {
    if (req.path === "/staff/search") {
        const ts = new Date().toISOString();
        const { service, lat, lng } = req.query;
        console.log(`🔎 [${ts}] STAFF SEARCH — service=${service} lat=${lat} lng=${lng} userId=${req.user?.id}`);
    }
    next();
};
exports.searchLogger = searchLogger;
//# sourceMappingURL=requestLogger.js.map