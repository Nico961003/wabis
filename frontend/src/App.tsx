import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import type { ProductDetail, ProductSummary } from "@wabis/shared";
import {
  createCategory,
  createColor,
  createProduct,
  createVariant,
  createSize,
  getAdminProduct,
  getAdminProducts,
  getDeletedProducts,
  getHistory,
  getProduct,
  getProducts,
  getCsrfToken,
  login,
  setProductStatus,
  updateInventory,
  updateImage,
  updateProduct,
  uploadImages,
  restoreProduct,
} from "./api";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M20.2 14.9A8.5 8.5 0 1 1 9.1 3.8a7 7 0 0 0 11.1 11.1Z" />
    </svg>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && window.localStorage?.getItem("wabis-theme") === "dark",
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage?.setItem("wabis-theme", dark ? "dark" : "light");
  }, [dark]);
  return (
    <button
      className={`theme-switch ${dark ? "is-dark" : ""}`}
      type="button"
      onClick={() => setDark((value) => !value)}
      aria-pressed={dark}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      <span className="theme-switch-track">
        <SunIcon />
        <MoonIcon />
      </span>
      <span className="theme-switch-thumb">{dark ? <MoonIcon /> : <SunIcon />}</span>
    </button>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          Wabis<span>.</span>
        </Link>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : undefined)}>
            Catálogo
          </NavLink>
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? "active" : undefined)}>
            Admin
          </NavLink>
          <NavLink to="/admin/avanzado" className={({ isActive }) => (isActive ? "active" : undefined)}>
            Gestión avanzada
          </NavLink>
          <ThemeToggle />
        </nav>
      </header>
      <main>{children}</main>
      <footer>© {new Date().getFullYear()} Wabis. Todos los derechos reservados.</footer>
    </div>
  );
}

function getVideoEmbedUrl(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    const tiktokMatch = url.pathname.match(/\/video\/(\d+)/);
    if (url.hostname.endsWith("tiktok.com") && tiktokMatch?.[1]) {
      return `https://www.tiktok.com/player/v1/${tiktokMatch[1]}?autoplay=1&loop=1&controls=1&music_info=1&description=1`;
    }
    if (url.hostname.endsWith("instagram.com")) {
      const instagramMatch = url.pathname.match(/\/(?:reel|p)\/([^/]+)/);
      if (instagramMatch?.[1]) return `https://www.instagram.com/${url.pathname.split("/")[1]}/${instagramMatch[1]}/embed`;
    }
  } catch {
    return null;
  }
  return null;
}

function ProductMedia({ product }: { product: ProductSummary }) {
  const [playing, setPlaying] = useState(Boolean(product.videoUrl));
  const embedUrl = product.videoUrl ? getVideoEmbedUrl(product.videoUrl) : null;
  const image = product.images[0];

  useEffect(() => {
    setPlaying(Boolean(product.videoUrl));
  }, [product.videoUrl]);

  const toggleVideo = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setPlaying((value) => !value);
  };

  return (
    <div className="product-image">
      {playing && embedUrl ? (
        <iframe
          className="product-video"
          src={embedUrl}
          title={`Video de ${product.name}`}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : image ? (
        <img src={image.url} alt={image.alt || product.name} />
      ) : (
        <span>Wabis</span>
      )}
      {embedUrl && (
        <button
          className={`video-toggle ${playing ? "is-playing" : ""}`}
          type="button"
          onClick={toggleVideo}
          aria-label={playing ? "Pausar video" : "Reproducir video"}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link className="product-card" to={`/producto/${product.id}`}>
      <ProductMedia product={product} />
      <div className="product-card-content">
        <div className="eyebrow">{product.categories.join(" · ") || "Maxisudadera"}</div>
        <h3>{product.name}</h3>
        <strong>${product.price.toFixed(2)} MXN</strong>
        {product.availability === "sold_out" && <span className="status-pill">Agotado</span>}
      </div>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function Catalog() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (sort) params.set("sort", sort);
    params.set("page", String(page));
    getProducts(params)
      .then((data) => setProducts(data.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [search, minPrice, maxPrice, sort, page]);
  return (
    <section className="catalog-page">
      <div className="hero">
        <div>
          <p className="eyebrow">Colección Wabis</p>
          <h1>Suave, amplia, muy tú.</h1>
          <p>Descubre maxisudaderas para sentirte cómoda sin dejar de expresarte.</p>
        </div>
        <div className="hero-shape">W</div>
      </div>
      <div className="catalog-toolbar">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h2>Piezas para todos los días</h2>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <SearchIcon />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar maxisudaderas..."
            aria-label="Buscar productos"
          />
        </label>
        <div className="filter-group">
          <label className="filter-chip">
            <span>Mín.</span>
            <input
              type="number"
              min="100"
              step="0.01"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              aria-label="Precio mínimo"
            />
          </label>
          <label className="filter-chip">
            <span>Máx.</span>
            <input
              type="number"
              min="100"
              step="0.01"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              aria-label="Precio máximo"
            />
          </label>
          <select
            className="filter-select"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            aria-label="Ordenar productos"
          >
            <option value="">Más recientes</option>
            <option value="price_asc">Precio menor</option>
            <option value="price_desc">Precio mayor</option>
          </select>
        </div>
      </div>
      {loading && <p className="notice">Cargando catálogo...</p>}
      {error && <p className="notice error">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="notice">No encontramos productos con esa búsqueda.</p>
      )}
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {products.length > 0 && (
        <div className="pagination">
          <button className="ghost-button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
            Anterior
          </button>
          <span>Página {page}</span>
          <button className="ghost-button" onClick={() => setPage((value) => value + 1)}>
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}

function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  useEffect(() => {
    if (id)
      getProduct(id)
        .then(setProduct)
        .catch(() => setProduct(null));
  }, [id]);
  if (!product) return <p className="notice">Cargando producto...</p>;
  return (
    <section className="detail-page">
      <Link className="back-link" to="/">
        ← Volver al catálogo
      </Link>
      <div className="detail-grid">
        <div className="detail-gallery">
          {product.videoUrl && getVideoEmbedUrl(product.videoUrl) && (
            <div className="detail-video">
              <iframe
                src={getVideoEmbedUrl(product.videoUrl) ?? undefined}
                title={`Video de ${product.name}`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <p className="video-hint">Activa el sonido desde los controles del video.</p>
            </div>
          )}
          {product.images.length ? (
            product.images.map((image) => <img key={image.id} src={image.url} alt={image.alt || product.name} />)
          ) : (
            <div className="product-image large">Wabis</div>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{product.categories.join(" · ")}</p>
          <h1>{product.name}</h1>
          <p className="price">${product.price.toFixed(2)} MXN</p>
          <p>{product.description}</p>
          {product.availability === "sold_out" && <div className="notice">Actualmente agotada.</div>}
          <h3>Colores</h3>
          <div className="chips">
            {product.colors.map((color) => (
              <span key={color.id}>{color.name}</span>
            ))}
          </div>
          {product.videoUrl && (
            <a className="button" href={product.videoUrl} target="_blank" rel="noreferrer">
              Ver video del producto ↗
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [csrf, setCsrf] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<ProductDetail | null>(null);
  const [newProduct, setNewProduct] = useState({ name: "", description: "", price: "100", videoUrl: "" });
  const [attributeName, setAttributeName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const load = () =>
    getAdminProducts()
      .then((result) => setProducts(result.items))
      .catch(() => setAuthenticated(false));
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await login(username, password);
      setCsrf(await getCsrfToken());
      setAuthenticated(true);
      setPassword("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar sesión.");
    }
  };
  const toggle = async (product: ProductSummary) => {
    if (product.status === "active" && !window.confirm(`¿Inactivar ${product.name}?`)) return;
    await setProductStatus(product.id, product.status === "active" ? "inactive" : "active", undefined, csrf);
    await load();
  };
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createProduct(
        {
          name: newProduct.name,
          description: newProduct.description,
          price: Number(newProduct.price),
          videoUrl: newProduct.videoUrl || null,
        },
        csrf,
      );
      setNewProduct({ name: "", description: "", price: "100", videoUrl: "" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el producto.");
    }
  };
  const selectProduct = async (product: ProductSummary) => setSelected(await getAdminProduct(String(product.id)));
  const handleImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (selected && event.target.files) setSelected(await uploadImages(selected.id, event.target.files, csrf));
  };
  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setSelected(
      await updateProduct(
        selected.id,
        {
          name: String(form.get("name")),
          description: String(form.get("description")),
          price: Number(form.get("price")),
          videoUrl: String(form.get("videoUrl") || "") || null,
        },
        csrf,
      ),
    );
    await load();
  };
  const addAttribute = async (kind: "color" | "size") => {
    if (!selected || !attributeName.trim()) return;
    if (kind === "color") await createColor(selected.id, attributeName, csrf);
    else await createSize(selected.id, attributeName, csrf);
    setAttributeName("");
    setSelected(await getAdminProduct(String(selected.id)));
  };
  const saveInventory = async (item: ProductDetail["inventory"][number], quantity: number) => {
    if (!selected) return;
    const result = await updateInventory(selected.id, item.colorId, item.sizeId, quantity, csrf);
    setSelected(result.product);
    await load();
  };
  const addCategory = async () => {
    if (!categoryName.trim()) return;
    await createCategory(categoryName, csrf);
    setCategoryName("");
  };
  const addVariant = async () => {
    if (!selected || !variantName.trim()) return;
    await createVariant(
      selected.id,
      variantName,
      variantPrice ? Number(variantPrice) : null,
      selected.colors.map((color) => color.id),
      csrf,
    );
    setVariantName("");
    setVariantPrice("");
    setSelected(await getAdminProduct(String(selected.id)));
  };
  const makePrimary = async (imageId: number) => {
    if (selected) setSelected(await updateImage(selected.id, imageId, { isPrimary: true }, csrf));
  };
  if (!authenticated)
    return (
      <section className="admin-page">
        <p className="eyebrow">Panel privado</p>
        <h1>Administración Wabis</h1>
        <form className="login-form" onSubmit={handleLogin}>
          <label>
            Usuario
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="notice error">{error}</p>}
          <button className="button" type="submit">
            Iniciar sesión
          </button>
        </form>
        <Link className="back-link" to="/">
          ← Volver al catálogo
        </Link>
      </section>
    );
  return (
    <section className="admin-page admin-dashboard">
      <p className="eyebrow">Panel privado</p>
      <h1>Administración</h1>
      <form className="create-form" onSubmit={handleCreate}>
        <h3>Nuevo producto</h3>
        <input
          required
          value={newProduct.name}
          onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
          placeholder="Nombre"
        />
        <textarea
          value={newProduct.description}
          onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })}
          placeholder="Descripción"
        />
        <input
          required
          min="100"
          step=".01"
          type="number"
          value={newProduct.price}
          onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })}
          placeholder="Precio MXN"
        />
        <input
          type="url"
          value={newProduct.videoUrl}
          onChange={(event) => setNewProduct({ ...newProduct, videoUrl: event.target.value })}
          placeholder="Enlace TikTok o Instagram (opcional)"
        />
        <button className="button" type="submit">
          Crear producto
        </button>
      </form>
      <div className="inline-form category-form">
        <input
          value={categoryName}
          onChange={(event) => setCategoryName(event.target.value)}
          placeholder="Nueva categoría"
        />
        <button type="button" className="ghost-button" onClick={() => void addCategory()}>
          Agregar categoría
        </button>
      </div>
      {error && <p className="notice error">{error}</p>}
      <div className="admin-list">
        {products.map((product) => (
          <article className="admin-row" key={product.id}>
            <button className="admin-product-name" onClick={() => selectProduct(product)}>
              <strong>{product.name}</strong>
              <span>
                {product.availability === "sold_out" ? "Agotado" : "Disponible"} ·{" "}
                {product.status === "active" ? "Visible" : "Inactivo"}
              </span>
            </button>
            <button className="ghost-button" onClick={() => toggle(product)}>
              {product.status === "active" ? "Inactivar" : "Activar"}
            </button>
          </article>
        ))}
      </div>
      {selected && (
        <div className="editor-stack">
          <form className="create-form" onSubmit={handleSave}>
            <h3>Editar: {selected.name}</h3>
            <input name="name" defaultValue={selected.name} required />
            <textarea name="description" defaultValue={selected.description} />
            <input name="price" type="number" min="100" step=".01" defaultValue={selected.price} />
            <input name="videoUrl" type="url" defaultValue={selected.videoUrl ?? ""} placeholder="TikTok o Instagram" />
            <button className="button" type="submit">
              Guardar cambios
            </button>
          </form>
          <div className="media-editor">
            <h3>Imágenes</h3>
            <input type="file" accept="image/png,image/jpeg" multiple onChange={handleImages} />
            <div className="admin-images">
              {selected.images.map((image) => (
                <div className="admin-image-item" key={image.id}>
                  <img src={image.url} alt={image.alt} />
                  <button type="button" className="ghost-button" onClick={() => void makePrimary(image.id)}>
                    {image.isPrimary ? "Principal" : "Hacer principal"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="create-form">
            <h3>Variantes comerciales</h3>
            <div className="inline-form">
              <input
                value={variantName}
                onChange={(event) => setVariantName(event.target.value)}
                placeholder="Nombre de variante"
              />
              <input
                type="number"
                min="100"
                step=".01"
                value={variantPrice}
                onChange={(event) => setVariantPrice(event.target.value)}
                placeholder="Precio opcional"
              />
              <button type="button" className="ghost-button" onClick={() => void addVariant()}>
                Agregar variante
              </button>
            </div>
            <div className="chips">
              {selected.variants.map((variant) => (
                <span key={variant.id}>
                  {variant.name}
                  {variant.price === null ? "" : ` · $${variant.price.toFixed(2)}`}
                </span>
              ))}
            </div>
          </div>
          <div className="create-form">
            <h3>Colores y tallas</h3>
            <div className="inline-form">
              <input
                value={attributeName}
                onChange={(event) => setAttributeName(event.target.value)}
                placeholder="Nombre"
              />
              <button type="button" className="ghost-button" onClick={() => addAttribute("color")}>
                Agregar color
              </button>
              <button type="button" className="ghost-button" onClick={() => addAttribute("size")}>
                Agregar talla
              </button>
            </div>
            <div className="chips">
              {selected.colors.map((color) => (
                <span key={color.id}>{color.name}</span>
              ))}
              {selected.sizes.map((size) => (
                <span key={size.id}>{size.name}</span>
              ))}
            </div>
          </div>
          <div className="create-form">
            <h3>Inventario por combinación</h3>
            {selected.inventory.map((item) => (
              <label className="inventory-row" key={item.id}>
                {item.colorName}
                {item.sizeName ? ` · ${item.sizeName}` : ""}
                <input
                  type="number"
                  min="0"
                  defaultValue={item.quantity}
                  onBlur={(event) => void saveInventory(item, Number(event.target.value))}
                />
                <span>{item.isSoldOut ? "Agotado" : "Disponible"}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <Link className="back-link" to="/">
        ← Volver al catálogo
      </Link>
    </section>
  );
}

function AdminAdvanced() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [csrf, setCsrf] = useState("");
  const [deletedProducts, setDeletedProducts] = useState<
    Array<{ id: number; name: string; deletedAt: string; deleteAfter: string }>
  >([]);
  const [history, setHistory] = useState<
    Array<{ id: number; productId: number | null; action: string; details: string; createdAt: string }>
  >([]);
  const load = async () => {
    try {
      const [deleted, historyEntries, token] = await Promise.all([getDeletedProducts(), getHistory(), getCsrfToken()]);
      setDeletedProducts(deleted);
      setHistory(historyEntries);
      setCsrf(token);
      setAuthorized(true);
    } catch {
      setAuthorized(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const restore = async (id: number) => {
    if (!window.confirm("¿Restaurar este producto?")) return;
    await restoreProduct(id, csrf);
    await load();
  };
  if (authorized === null) return <p className="notice">Cargando gestión avanzada...</p>;
  if (!authorized)
    return (
      <section className="admin-page">
        <p className="eyebrow">Acceso restringido</p>
        <h1>Gestión avanzada</h1>
        <p className="notice error">Debes iniciar sesión como administrador para ver esta sección.</p>
        <Link className="back-link" to="/admin">
          Ir a iniciar sesión →
        </Link>
      </section>
    );
  return (
    <section className="admin-page admin-dashboard">
      <p className="eyebrow">Panel privado</p>
      <h1>Gestión avanzada</h1>
      <section className="admin-advanced">
        <div className="create-form">
          <h3>Recuperación disponible</h3>
          {deletedProducts.length === 0 ? (
            <p className="notice">No hay productos pendientes de recuperación.</p>
          ) : (
            deletedProducts.map((product) => (
              <div className="admin-row" key={product.id}>
                <span>
                  {product.name}
                  <small> hasta {product.deleteAfter}</small>
                </span>
                <button className="ghost-button" onClick={() => void restore(product.id)}>
                  Restaurar
                </button>
              </div>
            ))
          )}
        </div>
        {history.length > 0 && (
          <details className="history-panel" open>
            <summary>Historial reciente</summary>
            {history.map((entry) => (
              <div className="history-row" key={entry.id}>
                <span>{entry.action}</span>
                <small>{entry.createdAt}</small>
              </div>
            ))}
          </details>
        )}
      </section>
      <Link className="back-link" to="/admin">
        ← Volver al panel
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/producto/:id" element={<ProductDetailPage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/avanzado" element={<AdminAdvanced />} />
      </Routes>
    </Layout>
  );
}
