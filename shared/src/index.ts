export type AdminStatus = "active" | "inactive";
export type Availability = "available" | "sold_out";

export interface ProductImage {
  id: number;
  url: string;
  thumbnailUrl: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductColor {
  id: number;
  name: string;
  hex: string | null;
}

export interface ProductSize {
  id: number;
  name: string;
}

export interface ProductVariant {
  id: number;
  name: string;
  price: number | null;
  colors: ProductColor[];
}

export interface InventoryItem {
  id: number;
  colorId: number;
  sizeId: number | null;
  colorName: string;
  sizeName: string | null;
  quantity: number;
  isSoldOut: boolean;
}

export interface ProductSummary {
  id: number;
  name: string;
  description: string;
  price: number;
  status: AdminStatus;
  availability: Availability;
  categories: string[];
  images: ProductImage[];
  videoUrl: string | null;
  colors: ProductColor[];
  sizes: ProductSize[];
}

export interface ProductDetail extends ProductSummary {
  variants: ProductVariant[];
  inventory: InventoryItem[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
