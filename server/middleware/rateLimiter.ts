import rateLimit from "express-rate-limit";

// POST /api/predictions/register: 10/min, 100/day
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
