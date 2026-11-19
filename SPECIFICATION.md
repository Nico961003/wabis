# Especificación — Catálogo Wabis

## Alcance

Catálogo informativo de maxisudaderas/wabies con catálogo público y panel administrativo protegido. La primera versión se ejecutará localmente y no incluirá carrito, pagos, pedidos, transacciones en línea ni cuentas públicas para clientes.

## Stack y restricciones

- Node.js para frontend y backend.
- TypeScript en todo el código de aplicación.
- React para el frontend.
- Express para el backend.
- SQLite como base de datos persistente.
- Dependencias estables y actualizadas, fijadas mediante lockfile.
- Node.js LTS estable vigente al momento de inicializar el proyecto.
- Documentación Markdown en la raíz del proyecto.
- No se implementarán respaldos en esta primera versión.

## Roles y autenticación

- Existirá un administrador inicial.
- Se podrán crear administradores adicionales en el futuro.
- La estructura de roles/permisos quedará preparada, pero solo existirá el rol Administrador en esta versión.
- El panel requerirá inicio de sesión.
- La contraseña se almacenará únicamente mediante hash seguro, con saltos; nunca en texto plano ni con cifrado reversible.
- La contraseña inicial se recibirá mediante una variable de entorno local no versionada.
- Se usarán sesiones almacenadas del lado del servidor y cookies `HttpOnly`.
- `Secure` se usará en producción y `SameSite` tendrá una política adecuada.
- Se implementará protección CSRF.
- Habrá cierre de sesión explícito.
- No habrá recuperación de contraseña, bloqueo por intentos fallidos ni cambio obligatorio de contraseña inicial.

## Productos y disponibilidad

Cada producto tendrá nombre, descripción, precio actual, categorías, colores, tallas opcionales, variantes comerciales, inventario, imágenes y un enlace opcional de video externo.

Estados:

- `activo`: visible en el catálogo público.
- `agotado`: visible en el catálogo público, búsquedas y filtros.
- `inactivo`: oculto del catálogo público, búsquedas y filtros.

Reglas:

- Stock cero marca automáticamente el producto como agotado.
- El administrador puede marcar manualmente un producto como agotado aunque tenga stock.
- No se permite stock negativo.
- No se calculará ni mostrará stock total agregado en esta versión.
- Los productos agotados continuarán visibles para comunicar su disponibilidad.

## Variantes, colores e inventario

- Todo producto debe tener al menos un color.
- Un producto puede no tener tallas.
- La clave de inventario será `producto + color + talla opcional`.
- Una variante no forma parte de la clave de inventario.
- En el caso simple, un color puede funcionar como variante comercial.
- En el caso agrupado, una variante puede agrupar varios colores.
- Un color solo podrá pertenecer a una variante dentro del mismo producto.
- La variante puede modificar el precio, pero no crea una existencia independiente del color y la talla.
- No se implementarán SKU en esta versión.
- Las cantidades serán enteros mayores o iguales a cero.

## Categorías

- Las categorías serán administrables.
- Un producto puede pertenecer a múltiples categorías.
- Una categoría tendrá únicamente nombre.
- No tendrá slug, descripción ni imagen.
- No se podrá eliminar una categoría asociada a productos.

## Precios

- Moneda: MXN.
- Impuestos incluidos.
- Precio mínimo: `100.00`.
- Sin precio máximo.
- Exactamente dos decimales.
- Solo se almacenará el precio actual.
- No habrá precio anterior, porcentajes de descuento ni cálculos de descuento.
- Los importes se almacenarán con representación exacta, evitando errores de punto flotante.

## Imágenes y videos

### Imágenes

- Se almacenarán localmente en un directorio persistente fuera del frontend público y de carpetas temporales.
- Formatos permitidos: PNG y JPG/JPEG.
- Máximo 5 MB por imagen.
- Máximo cinco imágenes por producto.
- Cada producto tendrá una imagen principal.
- Se generarán miniaturas.
- Los nombres de almacenamiento serán únicos y seguros.
- Las imágenes se conservarán durante los siete días de recuperación del producto eliminado.
- Después de siete días se eliminarán físicamente con el producto.

### Videos

- No se descargarán ni almacenarán videos localmente.
- Se almacenará como máximo un enlace externo por producto.
- Se admitirán enlaces de TikTok e Instagram.
- Se validarán los dominios y el formato de URL.
- La interfaz mostrará enlace directo y una inserción embebida cuando la plataforma lo permita.
- No aplican límites locales de formato, tamaño o duración.

Fuentes sociales autorizadas para contenido de prueba:

- Instagram: https://www.instagram.com/karyolyshop/
- TikTok: https://www.tiktok.com/@kary.oly
- Producto de prueba inicial: https://www.tiktok.com/@kary.oly/video/7701168685112692020

El contenido visible del video y las imágenes derivadas están autorizados por el usuario para los datos de prueba del proyecto. Se crearán capturas del video e imágenes promocionales derivadas, sin descargar ni almacenar el video.

## Eliminación y auditoría

- La eliminación inicial será lógica.
- El administrador podrá recuperar el producto durante siete días.
- Una tarea diaria eliminará físicamente después de siete días el producto, imágenes, enlace de video, inventario, relaciones e historial asociado.
- La tarea será idempotente y registrará errores sin detener el servidor.
- Se conservará historial de cambios mientras el registro exista.

## Persistencia y API

- SQLite se almacenará fuera de carpetas públicas y sobrevivirá a reinicios.
- Se implementarán migraciones reproducibles y seed idempotente.
- Se usarán repositorios/servicios para evitar SQL disperso en las rutas.
- Se utilizarán transacciones para actualizaciones relacionadas de producto, variantes, categorías e inventario.
- La API pública solo expondrá productos activos y agotados visibles.
- La API administrativa expondrá gestión de productos, categorías, colores, tallas, variantes, inventario, imágenes, enlaces de video, sesiones e historial.
- La API tendrá contratos tipados y respuestas de error consistentes.
- Se implementarán validación, paginación, filtros, búsqueda, ordenamiento y límites razonables.

## Estructura prevista

- `frontend/`: aplicación React y TypeScript.
- `backend/`: API Express y TypeScript.
- `shared/`: tipos y contratos compartidos cuando sea conveniente.
- SQLite, cargas y miniaturas en directorios locales ignorados por Git.
- `PROPUESTA.md`: plan de trabajo aprobado.

## Interfaz pública

- Encabezado y navegación.
- Buscador.
- Filtros combinables por categoría, talla, color, precio, estado y existencia.
- Ordenamiento y paginación.
- Tarjetas con imagen principal, nombre, precio y estado.
- Detalle con galería, imagen principal, enlace/video, variantes, colores, tallas, precio y disponibilidad.
- Productos agotados visibles con indicación clara.
- Productos inactivos ocultos.
- Estados de carga, vacío, error y sin resultados.
- Diseño responsive para móvil, tableta y escritorio.
- Modo claro y oscuro con preferencia persistente.
- Accesibilidad básica: contraste, foco, teclado, textos alternativos y controles etiquetados.

## Panel administrativo

- Login y cierre de sesión.
- Protección de rutas.
- Dashboard con productos activos, agotados e inactivos.
- Listado con búsqueda, filtros, paginación y acciones.
- Alta y edición de productos.
- Gestión de categorías, colores, tallas, variantes e inventario.
- Carga, sustitución, ordenamiento y eliminación de imágenes.
- Gestión de enlace de video externo.
- Imagen principal y miniaturas.
- Historial de cambios.
- Confirmaciones para inactivar, recuperar y eliminar definitivamente.

## Datos de prueba

Se crearán cinco productos de prueba inspirados en maxisudaderas. Uno se basará en el video de TikTok proporcionado y los restantes en productos similares del perfil autorizado de KaryOly. Cada producto tendrá nombre, descripción, categoría, precio válido, colores, inventario y multimedia permitida.

## Pruebas y aceptación

- Visitantes pueden consultar, buscar y filtrar sin autenticarse.
- Agotados aparecen públicamente; inactivos no aparecen.
- El administrador puede autenticarse y gestionar productos.
- Stock por color y talla opcional, sin valores negativos.
- Precio mínimo, moneda y precisión validados.
- Límites de imágenes y formatos validados.
- Enlaces de TikTok/Instagram validados.
- SQLite conserva datos después de reiniciar.
- Productos eliminados se recuperan durante siete días y luego se limpian mediante tarea diaria.
- Se ejecutan pruebas unitarias, integración, componentes y flujo completo.
- Lint, formateo, typecheck y build completan correctamente.
