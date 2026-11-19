# Plan actualizado — Catálogo Wabis

Este plan incorpora las decisiones funcionales confirmadas para definir el modelo de datos, autenticación, inventario, imágenes y administración antes de iniciar la implementación.

## Alcance confirmado

- Catálogo informativo de maxisudaderas/wabies, sin carrito, pagos, pedidos ni transacciones en línea.
- Frontend con React y TypeScript.
- Backend con Node.js, Express y TypeScript.
- Persistencia con SQLite.
- Un administrador inicial en el primer despliegue; se podrán crear administradores adicionales.
- La estructura de roles y permisos quedará preparada para el futuro, pero no se implementarán roles adicionales en esta versión.
- Las librerías serán estables y actualizadas, con versiones fijadas mediante el lockfile.
- Las contraseñas se gestionarán con hash seguro; no se almacenarán en texto plano ni mediante cifrado reversible.

## Reglas de disponibilidad

- El producto tendrá un estado administrativo independiente: `activo` o `inactivo`.
- El producto tendrá una disponibilidad independiente: `disponible` o `agotado`.
- El estado `inactivo` ocultará el producto del catálogo público, búsquedas y filtros, sin importar su disponibilidad.
- El estado `activo` permitirá que el producto aparezca públicamente.
- La disponibilidad `agotado` mantendrá el producto visible públicamente, con una indicación clara de que está agotado.
- La disponibilidad de un producto se marcará automáticamente como `agotado` únicamente cuando todas sus combinaciones de color y talla tengan stock cero.
- Si solo una combinación de color y talla tiene stock cero, únicamente esa combinación se marcará como agotada; el producto no se marcará como agotado automáticamente.
- El administrador podrá marcar manualmente la disponibilidad del producto como `agotado` aunque existan combinaciones con stock.
- Cuando cualquier combinación vuelva a tener stock positivo, la disponibilidad del producto volverá automáticamente a `disponible`.
- Los cambios automáticos de disponibilidad no modificarán el estado administrativo `activo/inactivo`.
- La administración podrá consultar productos activos, inactivos, disponibles y agotados.
- No se permitirá stock negativo.
- No se calculará ni mostrará el stock total del producto en esta versión; se administrará el stock individual de cada combinación.

## Modelo de productos, variantes e inventario

- Un producto tendrá nombre, descripción, precio en MXN, categorías, disponibilidad, imágenes, video, tallas, colores, variantes y existencias.
- Cada producto debe tener al menos un color; no se permitirán productos sin colores.
- Un producto podrá no tener tallas.
- El inventario se administrará por `producto + color + talla opcional`; la variante no formará parte de la clave de inventario.
- Cada combinación de color y talla opcional tendrá su propia cantidad y disponibilidad derivada.
- Una combinación con stock cero se mostrará como agotada sin cambiar automáticamente el estado administrativo del producto.
- En el caso simple, cada color podrá funcionar como una variante comercial.
- En el caso agrupado, una variante podrá agrupar varios colores, pero cada color solo podrá pertenecer a una variante dentro del mismo producto.
- La variante podrá modificar el precio, pero no generará una existencia independiente del color y la talla.
- Las variantes no tendrán SKU en esta primera versión.
- El precio podrá variar según la variante.
- Las categorías serán administrables.
- Un producto podrá pertenecer a múltiples categorías.
- Las categorías solo tendrán nombre; no tendrán slug, descripción ni imagen.
- No se podrá eliminar una categoría mientras esté asociada a productos.
- Las cantidades de inventario serán enteros mayores o iguales a cero.

## Precios

- La moneda será MXN.
- Los precios incluirán impuestos.
- Se mostrarán con decimales.
- El precio mínimo será de 100 MXN y no habrá límite máximo definido por ahora.
- Se permitirán exactamente dos decimales.
- Se almacenarán en una representación exacta para evitar errores de precisión monetaria.
- Solo se almacenará el precio actual.
- No habrá precio anterior, porcentaje de descuento, lógica de descuentos ni pruebas de descuentos.

## Imágenes y video

- Las imágenes se almacenarán localmente junto con la aplicación, en un directorio persistente y fuera de carpetas temporales.
- Se permitirán archivos PNG y JPG.
- Cada imagen tendrá un límite máximo de 5 MB.
- Cada producto podrá tener hasta cinco imágenes y un enlace externo de video.
- Se generarán miniaturas.
- Cada producto conservará una imagen principal.
- No se permitirán nombres de archivo duplicados.
- Al eliminar lógicamente un producto, sus imágenes, enlace de video y relaciones de inventario se conservarán.
- No se implementarán respaldos automáticos de SQLite ni de los archivos multimedia en esta versión.
- Los videos se manejarán únicamente mediante enlaces externos de TikTok e Instagram.
- No se descargarán ni almacenarán videos localmente.
- No aplicarán límites locales de tamaño, formato o duración.

### Nota sobre servir archivos en producción

“Servir las imágenes en producción” significa definir cómo el backend entregará las imágenes al navegador cuando la aplicación esté desplegada: por ejemplo, mediante una ruta estática protegida contra acceso a SQLite y a archivos internos, usando un directorio público controlado. Esta decisión se concretará en la configuración de despliegue.

## Autenticación y seguridad

- Se utilizarán sesiones con cookie y almacenamiento de sesión del lado del servidor.
- Las cookies serán `HttpOnly`, `Secure` en producción y tendrán una política `SameSite` adecuada.
- La sesión se cerrará después de 10 minutos de inactividad.
- Se implementará cierre de sesión explícito.
- Se implementará protección CSRF para las operaciones autenticadas mediante cookies.
- No habrá recuperación de contraseña, bloqueo por intentos fallidos ni función de cambio de contraseña en esta versión.
- La función de cambio de contraseña queda completamente fuera del alcance, tanto en el frontend como en la API administrativa.
- El usuario inicial se creará durante el seed/configuración, sin exponer la contraseña al cliente ni en respuestas de API.
- La contraseña inicial se proporcionará mediante una variable de entorno local no versionada.
- Las rutas administrativas requerirán autenticación y autorización.
- Se aplicarán validación de entradas, límites de solicitudes, mensajes no sensibles y controles de seguridad para archivos subidos.

## Eliminación y auditoría

- Los productos no se eliminarán físicamente.
- Se utilizará borrado lógico mediante estado inactivo/eliminado.
- Se conservarán imágenes, video, relaciones de inventario y datos relacionados.
- Se conservará un historial de cambios administrativos.
- Un producto eliminado podrá recuperarse durante una semana; después una tarea diaria lo eliminará físicamente junto con imágenes, enlace de video, inventario, relaciones e historial asociado.

## Estructura técnica prevista

- Repositorio único con frontend React y backend Express separados.
- Contratos tipados compartidos entre frontend y backend cuando resulte conveniente.
- Migraciones SQLite reproducibles y seed idempotente.
- Capas separadas para rutas, validación, servicios y acceso a datos.
- Transacciones para actualizaciones relacionadas de productos, variantes, categorías e inventario.
- API pública que exponga únicamente productos con estado administrativo `activo`; dentro de ellos podrá incluir disponibles y agotados.
- API administrativa que permita gestionar productos, categorías, variantes, tallas, colores, inventario, imágenes, video, sesiones e historial.
- Paginación, ordenamiento, filtros combinables, búsqueda y límites razonables.

## Interfaz prevista

- Catálogo público con encabezado, navegación, búsqueda, filtros, tarjetas y detalle de producto.
- Vista de detalle con galería, imagen principal, video, variantes, colores, tallas, precios y estado de disponibilidad.
- Productos agotados visibles con indicación clara de agotado.
- Productos inactivos no visibles para visitantes.
- Panel administrativo con inicio y cierre de sesión, protección de rutas, dashboard, listado, formularios, gestión de inventario, multimedia, categorías e historial.
- Diseño responsive para móvil, tableta y escritorio.
- Modo claro y oscuro con preferencia persistente.
- Estados de carga, vacío, error, agotado y comunicación fallida.
- Accesibilidad básica: contraste, foco, teclado, textos alternativos y controles etiquetados.

## Datos de prueba

- Se crearán al menos cinco productos de prueba.
- Cada producto tendrá nombre, descripción, categoría, precio, impuestos incluidos, disponibilidad, colores y stock.
- Los productos que correspondan tendrán tallas y variantes con precio actual.
- Las imágenes de prueba deberán tener licencia o procedencia permitida.
- Se verificará que los productos estén disponibles en el panel y en el catálogo público según su estado.

## Aspectos aún pendientes de aclarar

1. **Contenido exacto de prueba:** definir los nombres, descripciones, categorías, colores, tallas, precios e imágenes de los cinco productos.
2. **Contenido multimedia de prueba:** verificar los recursos derivados autorizados del video y seleccionar enlaces externos para los productos similares.
3. **Horario de la tarea diaria:** definir la hora o intervalo concreto en que se ejecutará la limpieza automática.
4. **Versión exacta de Node.js:** fijar la versión LTS instalada en el proyecto y documentar los comandos oficiales de instalación, desarrollo, pruebas y producción.
5. **Configuración local:** confirmar los puertos definitivos, rutas de SQLite, directorio de imágenes y variable de contraseña inicial.

## Verificación prevista

- Pruebas unitarias para validadores, precios, estados de disponibilidad e inventario.
- Pruebas de integración para autenticación, expiración por inactividad, CSRF, productos, categorías, multimedia, borrado lógico y SQLite.
- Pruebas de componentes para catálogo, filtros, detalle, login, formularios, carga de imágenes y panel sin cambio de contraseña.
- Prueba de flujo completo: iniciar sesión, crear o editar producto, modificar stock, gestionar multimedia, inactivar/recuperar y verificar el resultado público.
- Verificación de que el stock nunca sea negativo.
- Verificación de que los productos agotados sean visibles y los inactivos no aparezcan públicamente.
- Verificación de límites de cinco imágenes, 5 MB por imagen, PNG/JPG y una imagen principal.
- Ejecución de lint, formateo, typecheck, pruebas y build de frontend/backend.
- Validación responsive, accesibilidad básica y modo claro/oscuro.
- Revisión de que no existan credenciales, secretos, archivos temporales ni bases de desarrollo comprometidas en el repositorio.

## Contenido social autorizado para pruebas

- El video `https://www.tiktok.com/@kary.oly/video/7701168685112692020` corresponde a uno de los cinco productos de prueba.
- Se creará un producto de prueba basado en la información visible de ese video.
- El usuario autoriza utilizar el video y la información visible del producto como contenido de prueba.
- El usuario también autoriza crear imágenes derivadas del contenido autorizado para utilizarse dentro del proyecto.
- Se buscarán productos parecidos en el perfil de TikTok proporcionado para completar los otros productos de prueba.
- Los videos se manejarán como enlaces externos; no se descargarán ni almacenarán localmente.
- Antes de incorporar imágenes derivadas se deberá verificar que sean adecuadas para uso local en el proyecto y que no se expongan secretos o información personal innecesaria.

## Lista de seguimiento de implementación

### Fase 1 — Documentación y alcance

- [x] Revisar `AGENTS.md`.
- [x] Revisar y actualizar `SPECIFICATION.md`.
- [x] Crear `PROPUESTA.md` en la raíz del proyecto.
- [x] Confirmar separación entre estado administrativo `activo/inactivo` y disponibilidad `disponible/agotado`.
- [x] Confirmar modelo de inventario `producto + color + talla opcional`.
- [x] Confirmar política de imágenes, videos externos y limpieza automática.
- [x] Confirmar autenticación inicial y exclusiones de seguridad.

### Fase 2 — Inicialización técnica

- [x] Crear la estructura raíz del monorepo.
- [x] Crear el workspace `backend`.
- [x] Crear el workspace `frontend`.
- [x] Crear el workspace `shared`.
- [x] Crear configuraciones iniciales de TypeScript.
- [x] Crear configuración inicial de Vite.
- [x] Crear `.env.example`.
- [x] Crear `.gitignore`.
- [x] Instalar dependencias con npm.
- [x] Generar y revisar `package-lock.json`.
- [x] Configurar ESLint y reglas de calidad.
- [x] Configurar scripts completos de desarrollo, pruebas, lint, typecheck y build.

### Fase 3 — Tipos y persistencia SQLite

- [x] Crear tipos compartidos de productos, categorías, colores, tallas, variantes, inventario y multimedia.
- [x] Crear tipos compartidos de sesiones y respuestas de API.
- [x] Crear configuración de entorno validada.
- [x] Crear conexión SQLite.
- [x] Activar claves foráneas y pragmas de seguridad.
- [x] Crear migraciones reproducibles.
- [x] Crear tablas de usuarios y administradores.
- [x] Crear tablas de productos y estados.
- [x] Crear tablas de categorías y relaciones producto-categoría.
- [x] Crear tablas de colores, tallas y variantes.
- [x] Crear tabla de inventario por producto, color y talla opcional.
- [x] Crear tablas de imágenes, miniaturas y enlaces de video.
- [x] Crear tabla de historial de cambios.
- [x] Crear índices para búsquedas, filtros y relaciones.
- [x] Crear repositorios y servicios de acceso a datos.
- [x] Implementar transacciones para operaciones relacionadas.

### Fase 4 — Seed y reglas de negocio

- [x] Crear seed idempotente del administrador.
- [x] Leer la contraseña inicial desde variable de entorno.
- [x] Crear validación de nombre y datos de producto.
- [x] Crear validación de precio mínimo de 100 MXN.
- [x] Crear validación de dos decimales.
- [x] Crear validación de stock entero no negativo.
- [x] Crear validación de colores obligatorios.
- [x] Permitir productos sin tallas.
- [x] Implementar disponibilidad agotada del producto solo cuando todas sus combinaciones tengan stock cero.
- [x] Implementar disponibilidad agotada por combinación cuando su stock sea cero.
- [x] Permitir marcar manualmente la disponibilidad del producto como `agotado`.
- [x] Restaurar automáticamente la disponibilidad a `disponible` cuando una combinación tenga stock positivo.
- [x] Separar estado administrativo `activo/inactivo` de disponibilidad `disponible/agotado`.
- [x] Impedir exposición pública de productos con estado administrativo `inactivo`.
- [x] Implementar variantes comerciales con precio opcional.
- [x] Crear los cinco productos de prueba.
- [x] Asociar el video autorizado al producto correspondiente.
- [x] Crear ilustraciones promocionales locales derivadas para los productos de prueba.

### Fase 5 — Autenticación y seguridad del backend

- [x] Implementar hash seguro de contraseñas.
- [x] Implementar sesiones del lado del servidor.
- [x] Configurar cookies `HttpOnly`, `SameSite` y `Secure` según entorno.
- [x] Implementar login del administrador.
- [x] Implementar logout.
- [x] Implementar middleware de autenticación.
- [x] Implementar protección CSRF.
- [x] Implementar validación de entradas.
- [x] Implementar límites de solicitudes.
- [x] Implementar cabeceras de seguridad.
- [x] Evitar exposición de SQLite y directorios internos.
- [x] Evitar registrar contraseñas, cookies o datos sensibles.

### Fase 6 — API pública

- [x] Crear endpoint para listar productos visibles.
- [x] Crear endpoint para detalle de producto.
- [x] Implementar búsqueda por nombre y descripción.
- [x] Implementar filtro por categoría.
- [x] Implementar filtro por color.
- [x] Implementar filtro por talla.
- [x] Implementar filtro por precio.
- [x] Implementar filtro por estado y existencia.
- [x] Implementar ordenamiento.
- [x] Implementar paginación.
- [x] Implementar respuestas tipadas.
- [x] Implementar respuestas de error consistentes.
- [x] Ocultar información administrativa y de usuarios.

### Fase 7 — API administrativa y multimedia

- [x] Crear listado administrativo de productos.
- [x] Crear creación de productos.
- [x] Crear edición de productos.
- [x] Crear gestión de categorías.
- [x] Crear gestión de colores.
- [x] Crear gestión de tallas.
- [x] Crear gestión de variantes y precios por variante.
- [x] Crear actualización de inventario.
- [x] Impedir stock negativo en API y base de datos.
- [x] Crear carga de imágenes PNG/JPG.
- [x] Validar tamaño máximo de 5 MB por imagen.
- [x] Limitar a cinco imágenes por producto.
- [x] Gestionar imagen principal.
- [x] Generar miniaturas.
- [x] Generar nombres de archivos únicos y seguros.
- [x] Crear gestión de enlace externo de video.
- [x] Validar específicamente dominios de TikTok e Instagram.
- [x] Crear eliminación lógica.
- [x] Crear recuperación dentro de siete días.
- [x] Crear historial de cambios.
- [x] Crear tarea diaria de limpieza física después de siete días.

### Fase 8 — Frontend público

- [x] Crear layout público.
- [x] Crear encabezado y navegación.
- [x] Crear buscador.
- [x] Crear filtros combinables.
- [x] Crear ordenamiento y paginación.
- [x] Crear tarjetas de producto.
- [x] Crear indicador visual de agotado.
- [x] Crear detalle de producto.
- [x] Crear galería de imágenes.
- [x] Crear visualización del enlace/video externo.
- [x] Mostrar variantes, colores, tallas y precios.
- [x] Crear estados de carga.
- [x] Crear estado vacío.
- [x] Crear estados de error.
- [x] Crear modo claro.
- [x] Crear modo oscuro.
- [x] Persistir preferencia de tema.
- [x] Implementar diseño responsive.
- [x] Implementar accesibilidad básica.

### Fase 9 — Panel administrativo

- [x] Crear pantalla de login.
- [x] Crear protección de rutas privadas.
- [x] Crear navegación administrativa.
- [x] Crear dashboard.
- [x] Crear listado administrativo.
- [x] Crear formulario de producto.
- [x] Crear editor de categorías.
- [x] Crear editor de colores y tallas.
- [x] Crear editor de variantes.
- [x] Crear editor de inventario.
- [x] Crear carga y ordenamiento de imágenes.
- [x] Crear gestión de imagen principal.
- [x] Crear gestión de video externo.
- [x] Crear acciones para activar, agotar e inactivar.
- [x] Mostrar por separado el estado administrativo y la disponibilidad.
- [x] Mostrar el agotamiento individual de cada combinación de color y talla.
- [x] Crear recuperación de productos durante siete días.
- [x] Crear historial de cambios visible.
- [x] Crear confirmaciones de acciones destructivas.
- [x] Crear cierre de sesión.

### Fase 10 — Pruebas y verificación

- [x] Crear pruebas unitarias de validadores.
- [x] Crear pruebas unitarias de precios.
- [x] Crear pruebas unitarias de inventario.
- [x] Crear pruebas de estados de disponibilidad.
- [x] Probar restauración automática de disponibilidad después de aumentar el stock.
- [x] Crear pruebas de integración de SQLite.
- [x] Crear pruebas de login y sesión.
- [x] Crear pruebas de CSRF.
- [x] Crear pruebas de API pública.
- [x] Crear pruebas de API administrativa.
- [x] Crear pruebas de carga de imágenes.
- [x] Crear pruebas de enlaces de video.
- [x] Crear pruebas de borrado lógico y recuperación.
- [x] Crear pruebas de limpieza posterior a siete días.
- [x] Crear pruebas de componentes React.
- [x] Crear prueba de flujo completo.
- [x] Ejecutar lint.
- [x] Ejecutar formateo.
- [x] Ejecutar typecheck.
- [x] Ejecutar pruebas.
- [x] Ejecutar build de backend.
- [x] Ejecutar build de frontend.
- [x] Verificar ejecución desde un entorno limpio.
- [x] Revisar que no existan secretos o bases de datos comprometidas.
