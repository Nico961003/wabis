import { Router } from "express";
import { z } from "zod";
import { getProduct, listProducts } from "../services/products.js";

export const productsRouter = Router();

productsRouter.get("/", (req, res) => {
  const result = listProducts({
    publicOnly: true,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    category: typeof req.query.category === "string" ? req.query.category : undefined,
    color: typeof req.query.color === "string" ? req.query.color : undefined,
    size: typeof req.query.size === "string" ? req.query.size : undefined,
    minPrice: typeof req.query.minPrice === "string" ? Number(req.query.minPrice) : undefined,
    maxPrice: typeof req.query.maxPrice === "string" ? Number(req.query.maxPrice) : undefined,
    sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
    availability: typeof req.query.availability === "string" ? req.query.availability : undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 12,
  });
  res.json(result);
});

productsRouter.get("/:id", (req, res) => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: { code: "INVALID_ID", message: "Identificador inválido." } });
    return;
  }
  const product = getProduct(id.data, true);
  if (!product) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Producto no encontrado." } });
    return;
  }
  res.json(product);
});
