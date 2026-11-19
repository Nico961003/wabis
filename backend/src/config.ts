import "dotenv/config";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default("./data/wabis.sqlite"),
  UPLOAD_DIR: z.string().default("./uploads"),
  SESSION_SECRET: z.string().min(16).default("local-development-session-secret"),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
});

const parsed = envSchema.parse(process.env);
const root = process.cwd();

export const config = {
  port: parsed.PORT,
  databasePath: path.resolve(root, parsed.DATABASE_PATH),
  uploadDir: path.resolve(root, parsed.UPLOAD_DIR),
  sessionSecret: parsed.SESSION_SECRET,
  adminPassword: parsed.ADMIN_PASSWORD,
  frontendOrigin: parsed.FRONTEND_ORIGIN,
};
