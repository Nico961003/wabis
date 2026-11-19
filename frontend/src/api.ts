import type { Paginated, ProductDetail, ProductSummary } from "@wabis/shared";

const api = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok)
    throw new Error((await response.json().catch(() => null))?.error?.message ?? "No se pudo completar la solicitud.");
  return response.json() as Promise<T>;
}

export function getProducts(params: URLSearchParams): Promise<Paginated<ProductSummary>> {
  const query = params.toString();
  return request(`/products${query ? `?${query}` : ""}`);
}

export function getProduct(id: string): Promise<ProductDetail> {
  return request(`/products/${id}`);
}

export function login(username: string, password: string): Promise<{ authenticated: boolean }> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function getAdminProducts(): Promise<Paginated<ProductSummary>> {
  return request("/admin/products");
}

export function getAdminProduct(id: string): Promise<ProductDetail> {
  return request(`/admin/products/${id}`);
}

export function getDeletedProducts(): Promise<
  Array<{ id: number; name: string; deletedAt: string; deleteAfter: string }>
> {
  return request("/admin/products/deleted");
}

export function restoreProduct(id: number, csrfToken: string): Promise<ProductDetail> {
  return request(`/admin/products/${id}/restore`, { method: "POST", headers: { "x-csrf-token": csrfToken } });
}

export function getHistory(): Promise<
  Array<{ id: number; productId: number | null; action: string; details: string; createdAt: string }>
> {
  return request("/admin/history");
}

export async function getCsrfToken(): Promise<string> {
  const result = await request<{ token: string }>("/auth/csrf");
  return result.token;
}

export function setProductStatus(
  id: number,
  status: "active" | "inactive",
  availability?: "available" | "sold_out",
  csrfToken?: string,
): Promise<ProductSummary> {
  return request(`/admin/products/${id}/status`, {
    method: "PATCH",
    headers: { "x-csrf-token": csrfToken ?? "" },
    body: JSON.stringify({ status, availability }),
  });
}

export function createProduct(
  input: { name: string; description: string; price: number; videoUrl?: string | null },
  csrfToken: string,
): Promise<ProductSummary> {
  return request("/admin/products", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify(input),
  });
}

export function uploadImages(productId: number, files: FileList, csrfToken: string): Promise<ProductDetail> {
  const body = new FormData();
  Array.from(files).forEach((file) => body.append("images", file));
  return fetch(`${api}/admin/products/${productId}/images`, {
    method: "POST",
    credentials: "include",
    headers: { "x-csrf-token": csrfToken },
    body,
  }).then(async (response) => {
    if (!response.ok) throw new Error((await response.json()).error?.message ?? "No se pudieron cargar las imágenes.");
    return response.json() as Promise<ProductDetail>;
  });
}

export function updateProduct(
  id: number,
  input: { name?: string; description?: string; price?: number; videoUrl?: string | null },
  csrfToken: string,
): Promise<ProductDetail> {
  return request(`/admin/products/${id}`, {
    method: "PATCH",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify(input),
  });
}

export function updateInventory(
  productId: number,
  colorId: number,
  sizeId: number | null,
  quantity: number,
  csrfToken: string,
): Promise<{ product: ProductDetail }> {
  return request(`/admin/products/${productId}/inventory`, {
    method: "PUT",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify({ colorId, sizeId, quantity }),
  });
}

export function createCategory(name: string, csrfToken: string): Promise<{ id: number; name: string }> {
  return request("/admin/categories", {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify({ name }),
  });
}

export function createColor(productId: number, name: string, csrfToken: string): Promise<unknown> {
  return request(`/admin/products/${productId}/colors`, {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify({ name }),
  });
}

export function createSize(productId: number, name: string, csrfToken: string): Promise<unknown> {
  return request(`/admin/products/${productId}/sizes`, {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify({ name }),
  });
}

export function createVariant(
  productId: number,
  name: string,
  price: number | null,
  colorIds: number[],
  csrfToken: string,
): Promise<unknown> {
  return request(`/admin/products/${productId}/variants`, {
    method: "POST",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify({ name, price, colorIds }),
  });
}

export function updateImage(
  productId: number,
  imageId: number,
  input: { isPrimary?: boolean; sortOrder?: number },
  csrfToken: string,
): Promise<ProductDetail> {
  return request(`/admin/products/${productId}/images/${imageId}`, {
    method: "PATCH",
    headers: { "x-csrf-token": csrfToken },
    body: JSON.stringify(input),
  });
}
