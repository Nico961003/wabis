import { db } from "../db/database.js";
import type { InventoryItem, ProductDetail, ProductImage, ProductSummary } from "@wabis/shared";

type ProductRow = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  admin_status: "active" | "inactive";
  availability: "available" | "sold_out";
  video_url: string | null;
};

function imageRows(productId: number): ProductImage[] {
  return (
    db
      .prepare(
        "SELECT id, file_name, thumbnail_file_name, alt, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order, id",
      )
      .all(productId) as Array<{
      id: number;
      file_name: string;
      thumbnail_file_name: string;
      alt: string;
      is_primary: number;
      sort_order: number;
    }>
  ).map((image) => ({
    id: image.id,
    url: `/uploads/${image.file_name}`,
    thumbnailUrl: `/uploads/${image.thumbnail_file_name || image.file_name}`,
    alt: image.alt,
    isPrimary: Boolean(image.is_primary),
    sortOrder: image.sort_order,
  }));
}

function categories(productId: number): string[] {
  return (
    db
      .prepare(
        "SELECT c.name FROM categories c JOIN product_categories pc ON pc.category_id = c.id WHERE pc.product_id = ? ORDER BY c.name",
      )
      .all(productId) as Array<{ name: string }>
  ).map((row) => row.name);
}

function summary(row: ProductRow): ProductSummary {
  const colors = db
    .prepare("SELECT id, name, hex FROM colors WHERE product_id = ? ORDER BY name")
    .all(row.id) as Array<{ id: number; name: string; hex: string | null }>;
  const sizes = db.prepare("SELECT id, name FROM sizes WHERE product_id = ? ORDER BY name").all(row.id) as Array<{
    id: number;
    name: string;
  }>;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price_cents / 100,
    status: row.admin_status,
    availability: row.availability,
    categories: categories(row.id),
    images: imageRows(row.id),
    videoUrl: row.video_url,
    colors,
    sizes,
  };
}

export function listProducts(options: {
  publicOnly?: boolean;
  search?: string;
  category?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 12));
  const conditions = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];
  if (options.publicOnly) conditions.push("p.admin_status = 'active'");
  if (options.search) {
    conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    params.push(`%${options.search}%`, `%${options.search}%`);
  }
  if (options.availability === "available" || options.availability === "sold_out") {
    conditions.push("p.availability = ?");
    params.push(options.availability);
  }
  if (options.category) {
    conditions.push(
      "EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id AND c.name = ?)",
    );
    params.push(options.category);
  }
  if (options.color) {
    conditions.push("EXISTS (SELECT 1 FROM colors c WHERE c.product_id = p.id AND c.name = ?)");
    params.push(options.color);
  }
  if (options.size) {
    conditions.push("EXISTS (SELECT 1 FROM sizes s WHERE s.product_id = p.id AND s.name = ?)");
    params.push(options.size);
  }
  if (typeof options.minPrice === "number" && Number.isFinite(options.minPrice)) {
    conditions.push("p.price_cents >= ?");
    params.push(Math.round(options.minPrice * 100));
  }
  if (typeof options.maxPrice === "number" && Number.isFinite(options.maxPrice)) {
    conditions.push("p.price_cents <= ?");
    params.push(Math.round(options.maxPrice * 100));
  }
  const where = conditions.join(" AND ");
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM products p WHERE ${where}`).get(...params) as { count: number }
  ).count;
  const orderBy =
    options.sort === "price_asc"
      ? "p.price_cents ASC"
      : options.sort === "price_desc"
        ? "p.price_cents DESC"
        : "p.updated_at DESC, p.id DESC";
  const rows = db
    .prepare(`SELECT p.* FROM products p WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as ProductRow[];
  return { items: rows.map(summary), page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export function getProduct(id: number, publicOnly = false): ProductDetail | null {
  const row = db
    .prepare(
      `SELECT * FROM products WHERE id = ? AND deleted_at IS NULL ${publicOnly ? "AND admin_status = 'active'" : ""}`,
    )
    .get(id) as ProductRow | undefined;
  if (!row) return null;
  const base = summary(row);
  const variants = db
    .prepare("SELECT id, name, price_cents FROM variants WHERE product_id = ? ORDER BY name")
    .all(id) as Array<{ id: number; name: string; price_cents: number | null }>;
  const inventory = db
    .prepare(
      `
    SELECT i.id, i.color_id AS colorId, i.size_id AS sizeId, c.name AS colorName, s.name AS sizeName, i.quantity
    FROM inventory i JOIN colors c ON c.id = i.color_id
    LEFT JOIN sizes s ON s.id = i.size_id
    WHERE i.product_id = ? ORDER BY c.name, s.name
  `,
    )
    .all(id) as Array<Omit<InventoryItem, "isSoldOut">>;
  return {
    ...base,
    variants: variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      price: variant.price_cents === null ? null : variant.price_cents / 100,
      colors: [],
    })),
    inventory: inventory.map((item) => ({ ...item, isSoldOut: item.quantity === 0 })),
  };
}
