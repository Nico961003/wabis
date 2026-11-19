import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import multer from "multer";
import sharp from "sharp";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { csrfMatches } from "./auth.js";
import { getProduct, listProducts } from "../services/products.js";
import { updateInventory } from "../services/inventory.js";
import { recordAudit } from "../services/audit.js";

export const adminRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => callback(null, ["image/png", "image/jpeg"].includes(file.mimetype)),
});

adminRouter.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !csrfMatches(req)) {
    res.status(403).json({ error: { code: "CSRF_INVALID", message: "Token CSRF inválido." } });
    return;
  }
  next();
});

adminRouter.get("/products", (req, res) => {
  res.json(
    listProducts({
      publicOnly: false,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      availability: typeof req.query.availability === "string" ? req.query.availability : undefined,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    }),
  );
});

adminRouter.get("/products/deleted", (_req, res) => {
  res.json(
    db
      .prepare(
        "SELECT id, name, deleted_at AS deletedAt, delete_after AS deleteAfter FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
      )
      .all(),
  );
});

adminRouter.get("/products/:id", (req, res) => {
  const product = getProduct(Number(req.params.id));
  if (!product) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
    return;
  }
  res.json(product);
});

adminRouter.get("/categories", (_req, res) => {
  res.json(db.prepare("SELECT id, name FROM categories ORDER BY name").all());
});

adminRouter.get("/history", (_req, res) => {
  res.json(
    db
      .prepare(
        "SELECT id, product_id AS productId, action, details, created_at AS createdAt FROM audit_log ORDER BY id DESC LIMIT 100",
      )
      .all(),
  );
});

adminRouter.post("/categories", (req, res, next) => {
  try {
    const name = z.string().trim().min(1).max(80).parse(req.body.name);
    const result = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    res.status(201).json({ id: Number(result.lastInsertRowid), name });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/categories/:id", (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    if (result.changes === 0) {
      res
        .status(409)
        .json({ error: { code: "CATEGORY_IN_USE", message: "La categoría no existe o está asociada a productos." } });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const externalVideoUrl = z
  .string()
  .url()
  .max(1000)
  .refine((value) => {
    const hostname = new URL(value).hostname.toLowerCase();
    return ["tiktok.com", "www.tiktok.com", "instagram.com", "www.instagram.com"].includes(hostname);
  }, "El video debe ser un enlace de TikTok o Instagram.");

const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000).default(""),
  price: z.number().min(100).multipleOf(0.01),
  videoUrl: externalVideoUrl.nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  availability: z.enum(["available", "sold_out"]).default("available"),
  categoryNames: z.array(z.string().trim().min(1).max(80)).default([]),
});

adminRouter.post("/products", (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    const productId = db.transaction(() => {
      const result = db
        .prepare(
          `
        INSERT INTO products (name, description, price_cents, admin_status, availability, video_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          body.name,
          body.description,
          Math.round(body.price * 100),
          body.status,
          body.availability,
          body.videoUrl ?? null,
        );
      const id = Number(result.lastInsertRowid);
      for (const categoryName of body.categoryNames) {
        db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)").run(categoryName);
        const category = db.prepare("SELECT id FROM categories WHERE name = ?").get(categoryName) as { id: number };
        db.prepare("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)").run(id, category.id);
      }
      return id;
    })();
    recordAudit(productId, req.session.userId, "product.created", body);
    res.status(201).json(getProduct(productId));
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/products/:id", (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const body = productSchema.partial().parse(req.body);
    const current = db.prepare("SELECT * FROM products WHERE id = ? AND deleted_at IS NULL").get(id) as
      | {
          name: string;
          description: string;
          price_cents: number;
          admin_status: string;
          availability: string;
          video_url: string | null;
        }
      | undefined;
    if (!current) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
      return;
    }
    db.prepare(
      `
      UPDATE products SET name = ?, description = ?, price_cents = ?, admin_status = ?, availability = ?, video_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    ).run(
      body.name ?? current.name,
      body.description ?? current.description,
      body.price === undefined ? current.price_cents : Math.round(body.price * 100),
      body.status ?? current.admin_status,
      body.availability ?? current.availability,
      body.videoUrl === undefined ? current.video_url : body.videoUrl,
      id,
    );
    recordAudit(id, req.session.userId, "product.updated", body);
    res.json(getProduct(id));
  } catch (error) {
    next(error);
  }
});

const attributeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  hex: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional(),
});
adminRouter.post("/products/:id/colors", (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.id);
    const body = attributeSchema.parse(req.body);
    const result = db
      .prepare("INSERT INTO colors (product_id, name, hex) VALUES (?, ?, ?)")
      .run(productId, body.name, body.hex ?? null);
    res.status(201).json({ id: Number(result.lastInsertRowid), name: body.name, hex: body.hex ?? null });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/products/:id/sizes", (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.id);
    const name = z.string().trim().min(1).max(40).parse(req.body.name);
    const result = db.prepare("INSERT INTO sizes (product_id, name) VALUES (?, ?)").run(productId, name);
    res.status(201).json({ id: Number(result.lastInsertRowid), name });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/products/:id/variants", (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.id);
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        price: z.number().min(100).multipleOf(0.01).nullable().optional(),
        colorIds: z.array(z.number().int().positive()).default([]),
      })
      .parse(req.body);
    const variantId = db.transaction(() => {
      const result = db
        .prepare("INSERT INTO variants (product_id, name, price_cents) VALUES (?, ?, ?)")
        .run(
          productId,
          body.name,
          body.price === null || body.price === undefined ? null : Math.round(body.price * 100),
        );
      const id = Number(result.lastInsertRowid);
      for (const colorId of body.colorIds)
        db.prepare("INSERT INTO variant_colors (variant_id, color_id) VALUES (?, ?)").run(id, colorId);
      return id;
    })();
    res.status(201).json({ id: variantId, name: body.name, price: body.price ?? null, colorIds: body.colorIds });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/products/:id/status", (req, res, next) => {
  try {
    const body = z
      .object({ status: z.enum(["active", "inactive"]), availability: z.enum(["available", "sold_out"]).optional() })
      .parse(req.body);
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const result = db
      .prepare(
        "UPDATE products SET admin_status = ?, availability = COALESCE(?, availability), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
      )
      .run(body.status, body.availability ?? null, id);
    if (result.changes === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
      return;
    }
    recordAudit(id, req.session.userId, "product.status_changed", body);
    res.json(getProduct(id));
  } catch (error) {
    next(error);
  }
});

adminRouter.put("/products/:id/inventory", (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.id);
    const body = z
      .object({
        colorId: z.number().int().positive(),
        sizeId: z.number().int().positive().nullable().default(null),
        quantity: z.number().int().min(0),
      })
      .parse(req.body);
    const product = db.prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL").get(productId);
    if (!product) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
      return;
    }
    const availability = updateInventory(productId, body.colorId, body.sizeId, body.quantity);
    recordAudit(productId, req.session.userId, "inventory.updated", body);
    res.json({ productId, availability, product: getProduct(productId) });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/products/:id/images", upload.array("images", 5), async (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.id);
    const product = db.prepare("SELECT id FROM products WHERE id = ? AND deleted_at IS NULL").get(productId);
    if (!product) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
      return;
    }
    const current = (
      db.prepare("SELECT COUNT(*) AS count FROM product_images WHERE product_id = ?").get(productId) as {
        count: number;
      }
    ).count;
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (current + files.length > 5) {
      res.status(400).json({ error: { code: "IMAGE_LIMIT", message: "Cada producto admite hasta cinco imágenes." } });
      return;
    }
    const productDir = path.join(config.uploadDir, String(productId));
    await fs.mkdir(productDir, { recursive: true });
    const insert = db.prepare(
      "INSERT INTO product_images (product_id, file_name, thumbnail_file_name, original_name, alt, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const created: string[] = [];
    for (const file of files) {
      const id = crypto.randomUUID();
      const fileName = `${id}.webp`;
      const thumbnailName = `${id}-thumb.webp`;
      await sharp(file.buffer).rotate().webp({ quality: 86 }).toFile(path.join(productDir, fileName));
      await sharp(file.buffer)
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(productDir, thumbnailName));
      const storedFile = `${productId}/${fileName}`;
      const storedThumb = `${productId}/${thumbnailName}`;
      insert.run(
        productId,
        storedFile,
        storedThumb,
        file.originalname,
        file.originalname,
        current + created.length === 0 ? 1 : 0,
        current + created.length,
      );
      created.push(storedFile);
    }
    res.status(201).json(getProduct(productId));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/products/:productId/images/:imageId", async (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.productId);
    const imageId = z.coerce.number().int().positive().parse(req.params.imageId);
    const image = db
      .prepare("SELECT file_name, thumbnail_file_name FROM product_images WHERE id = ? AND product_id = ?")
      .get(imageId, productId) as { file_name: string; thumbnail_file_name: string } | undefined;
    if (!image) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Imagen no encontrada." } });
      return;
    }
    await Promise.allSettled([
      fs.unlink(path.join(config.uploadDir, image.file_name)),
      fs.unlink(path.join(config.uploadDir, image.thumbnail_file_name)),
    ]);
    db.prepare("DELETE FROM product_images WHERE id = ?").run(imageId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/products/:productId/images/:imageId", (req, res, next) => {
  try {
    const productId = z.coerce.number().int().positive().parse(req.params.productId);
    const imageId = z.coerce.number().int().positive().parse(req.params.imageId);
    const body = z
      .object({
        isPrimary: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        alt: z.string().max(200).optional(),
      })
      .parse(req.body);
    if (body.isPrimary) db.prepare("UPDATE product_images SET is_primary = 0 WHERE product_id = ?").run(productId);
    const result = db
      .prepare(
        "UPDATE product_images SET is_primary = COALESCE(?, is_primary), sort_order = COALESCE(?, sort_order), alt = COALESCE(?, alt) WHERE id = ? AND product_id = ?",
      )
      .run(
        body.isPrimary === undefined ? null : Number(body.isPrimary),
        body.sortOrder ?? null,
        body.alt ?? null,
        imageId,
        productId,
      );
    if (result.changes === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Imagen no encontrada." } });
      return;
    }
    res.json(getProduct(productId));
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/products/:id", (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const result = db
      .prepare(
        "UPDATE products SET admin_status = 'inactive', deleted_at = CURRENT_TIMESTAMP, delete_after = datetime('now', '+7 days'), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
      )
      .run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
      return;
    }
    recordAudit(id, req.session.userId, "product.deleted", { deleteAfterDays: 7 });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/products/:id/restore", (req, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const result = db
      .prepare(
        "UPDATE products SET admin_status = 'active', deleted_at = NULL, delete_after = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NOT NULL AND delete_after > CURRENT_TIMESTAMP",
      )
      .run(id);
    if (result.changes === 0) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND_OR_EXPIRED",
          message: "El producto no existe o ya expiró su periodo de recuperación.",
        },
      });
      return;
    }
    recordAudit(id, req.session.userId, "product.restored");
    res.json(getProduct(id));
  } catch (error) {
    next(error);
  }
});
