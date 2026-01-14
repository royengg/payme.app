import type { Request, Response, NextFunction } from "express";

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const apiSecret = process.env.API_SECRET;

  if (!apiSecret) {
    console.error("API_SECRET not configured");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization" });
  }

  const token = authHeader.slice(7);
  if (token !== apiSecret) {
    return res.status(401).json({ error: "Invalid authorization" });
  }

  next();
}
