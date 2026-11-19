import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { db, migrate } from "./db/database.js";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { adminRouter } from "./routes/admin.js";
import { requireAuth } from "./middleware/auth.js";
import { cleanExpiredProducts } from "./services/cleanup.js";

migrate();
fs.mkdirSync(config.uploadDir, { recursive: true });
void cleanExpiredProducts();
const cleanupTimer = setInterval(() => void cleanExpiredProducts(), 24 * 60 * 60 * 1000);
cleanupTimer.unref();

const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.frontendOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
app.use(
  session({
    name: "wabis.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60 * 1000 },
  }),
);
app.use((req, _res, next) => {
  if (req.session.userId && req.session.lastActivity && Date.now() - req.session.lastActivity > 10 * 60 * 1000) {
    req.session.destroy(() => next());
    return;
  }
  if (req.session.userId) req.session.lastActivity = Date.now();
  next();
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/uploads", express.static(path.resolve(config.uploadDir), { dotfiles: "deny", index: false }));
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/admin", requireAuth, adminRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error instanceof Error ? error.message : "Unhandled error");
  res.status(400).json({ error: { code: "REQUEST_ERROR", message: "No se pudo procesar la solicitud." } });
});

const server =
  process.env.NODE_ENV === "test"
    ? undefined
    : app.listen(config.port, () => {
        console.log(`Wabis API escuchando en http://localhost:${config.port}`);
      });

function cleanup(): void {
  clearInterval(cleanupTimer);
  if (server) server.close(() => db.close());
  else db.close();
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

export { app };
