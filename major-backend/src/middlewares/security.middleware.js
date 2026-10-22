import { ApiError } from "../utils/ApiError.js";

/**
 * Lightweight in-memory rate limiter
 * Tracks request counts per IP address within a sliding time window.
 */
class InMemoryRateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60 * 1000; // default 1 minute
        this.max = options.max || 100; // max hits per window
        this.message = options.message || "Too many requests, please try again later.";
        this.hits = new Map();

        // Periodically purge expired entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [key, record] of this.hits.entries()) {
                if (now - record.startTime > this.windowMs) {
                    this.hits.delete(key);
                }
            }
        }, 5 * 60 * 1000).unref();
    }

    middleware() {
        return (req, res, next) => {
            // Respect Express trust proxy setting via req.ip; fallback safely to socket remoteAddress
            const clientIp =
                req.ip ||
                (req.app?.get?.("trust proxy") ? req.headers["x-forwarded-for"]?.split(",")[0]?.trim() : null) ||
                req.socket?.remoteAddress ||
                "unknown_ip";

            const now = Date.now();
            const record = this.hits.get(clientIp);

            if (!record) {
                this.hits.set(clientIp, { count: 1, startTime: now });
                return next();
            }

            // Window has expired, reset window
            if (now - record.startTime > this.windowMs) {
                this.hits.set(clientIp, { count: 1, startTime: now });
                return next();
            }

            // Increment count within window
            record.count += 1;

            if (record.count > this.max) {
                const retryAfterSec = Math.ceil(
                    (record.startTime + this.windowMs - now) / 1000
                );
                res.setHeader("Retry-After", retryAfterSec);
                return next(new ApiError(429, this.message));
            }

            next();
        };
    }
}

// 15 login / register attempts per 15 minutes
export const authRateLimiter = new InMemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 25,
    message: "Too many authentication attempts. Please try again after 15 minutes."
}).middleware();

// 200 general requests per minute
export const generalApiLimiter = new InMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: 250,
    message: "Rate limit exceeded. Please throttle your requests."
}).middleware();

// 15 job application attempts per minute
export const applyRateLimiter = new InMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: "Too many application requests submitted. Please slow down."
}).middleware();

// Password reset request limiter (max 5 OTP requests per 15 minutes per IP)
export const passwordResetRequestLimiter = new InMemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: "Too many password recovery requests. Please try again after 15 minutes."
}).middleware();

// Password reset action limiter (max 15 verification / reset calls per 15 minutes per IP)
export const passwordResetActionLimiter = new InMemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many verification or reset submissions. Please slow down."
}).middleware();

// Certificate validation limiter (max 20 validation requests per 15 minutes per IP)
export const certificateValidationLimiter = new InMemoryRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many certificate validation attempts. Please try again after 15 minutes."
}).middleware();

/**
 * Security headers middleware setting OWASP-recommended HTTP headers
 */
export const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.removeHeader("X-Powered-By");
    next();
};
