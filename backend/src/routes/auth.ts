import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { Request } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { db } from "../db/database.js";
import { config } from "../config.js";

export const authRouter = Router();
const loginSchema = z.object({ username: z.string().min(1).max(100), password: z.string().min(1) });

authRouter.get("/csrf", (req, res) => {
  const token = randomBytes(24).toString("hex");
  req.session.csrfToken = token;
  res.json({ token });
});

authRouter.get("/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, username: "Admin" });
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = db.prepare("SELECT id, username, password_hash FROM users WHERE username = ?").get(body.username) as
      { id: number; username: string; password_hash: string } | undefined;
    if (!user || !(await argon2.verify(user.password_hash, body.password))) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciales inválidas." } });
      return;
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.userId = user.id;
      req.session.lastActivity = Date.now();
      res.json({ authenticated: true, username: user.username });
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("wabis.sid");
    res.status(204).send();
  });
});

export function csrfMatches(req: Request): boolean {
  const token = req.headers["x-csrf-token"];
  return typeof token === "string" && token.length > 0 && token === req.session.csrfToken;
}

void config;
