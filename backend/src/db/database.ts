import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new Database(config.databasePath);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL CHECK (price_cents >= 10000),
      admin_status TEXT NOT NULL DEFAULT 'active' CHECK (admin_status IN ('active','inactive')),
      availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','sold_out')),
      video_url TEXT,
      deleted_at TEXT,
      delete_after TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS product_categories (
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      PRIMARY KEY (product_id, category_id)
    );
    CREATE TABLE IF NOT EXISTS colors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      hex TEXT,
      UNIQUE(product_id, name)
    );
    CREATE TABLE IF NOT EXISTS sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE(product_id, name)
    );
    CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 10000),
      UNIQUE(product_id, name)
    );
    CREATE TABLE IF NOT EXISTS variant_colors (
      variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
      color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
      PRIMARY KEY (variant_id, color_id)
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      color_id INTEGER NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
      size_id INTEGER REFERENCES sizes(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity >= 0),
      UNIQUE(product_id, color_id, size_id)
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL UNIQUE,
      thumbnail_file_name TEXT NOT NULL DEFAULT '',
      original_name TEXT NOT NULL,
      alt TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_public ON products(admin_status, availability, deleted_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id, quantity);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);
  `);
  const imageColumns = db.prepare("PRAGMA table_info(product_images)").all() as Array<{ name: string }>;
  if (!imageColumns.some((column) => column.name === "thumbnail_file_name")) {
    db.exec("ALTER TABLE product_images ADD COLUMN thumbnail_file_name TEXT NOT NULL DEFAULT ''");
  }
}
