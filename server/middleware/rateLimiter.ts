import rateLimit from "express-rate-limit";

// Known limitation: the default in-memory store is per-process. On Vercel
// serverless each lambda instance keeps its own counters, so the effective
// limit scales with concurrent instances. Accepted: abuse here means spam,
// not compromise. A shared store (Redis/Postgres) can be added if needed.

// POST /api/predictions/register: 10/min per IP
export const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many prediction registrations, please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/predictions/claim: 5/hour
export const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: "Too many claim attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET endpoints: 100/min
export const getLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
