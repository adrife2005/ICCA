# ICCA — Landing + CMS

Landing de la artista (colores y estructura de la original) **100 % editable** desde un dashboard con login.

## Arrancar (2 minutos)

```bash
npm install            # solo instala "sharp" (optimizador de imágenes)
cp .env.example .env   # y cambia ADMIN_PASSWORD
npm start
```

- Sitio: http://localhost:3000
- Dashboard: http://localhost:3000/admin

Requiere **Node 22.13 o superior** (usa el SQLite que ya trae Node, sin instalar base de datos).
Si no defines `ADMIN_PASSWORD`, el servidor genera una contraseña y la imprime en consola en el primer arranque.

Crear/cambiar un usuario: `npm run create-user -- usuario contraseña`

## Qué puede editar la artista

| Sección del dashboard | Qué controla |
|---|---|
| General | Logo/nombre, imagen de fondo animado, pie de página |
| Inicio (portada) | Etiqueta, 3 líneas del título, descripción, botón, obra principal |
| Obras destacadas | Las 3 obras del inicio (imagen, título, técnica) |
| Franja en movimiento | Texto que se repite |
| Secretos y conceptos | Cartas que se voltean (agregar, quitar, reordenar) |
| Lienzo oculto | Obra del rasca-rasca, textos, técnica, dimensiones |
| Contacto | Instagram, WhatsApp, correo (también a dónde llega el formulario) |
| **Obras de la galería** | Alta/baja/edición/orden de cada obra de la página Galería (título, año, contexto, técnica, simbolismo, secretos, audioguía) y mostrar/ocultar |
| Cuenta | Cambiar contraseña, cerrar sesión |

Los cambios se ven al instante en el sitio al pulsar **Guardar cambios**.

## Base de datos — recomendación

**Regla de oro: las imágenes NO se guardan dentro de la base de datos.** Se guardan como archivos y la base solo guarda sus datos (texto, orden, qué imagen usa cada sección).

**Lo que trae este proyecto (ideal para esta entrega):**
- **SQLite** → un solo archivo (`data/icca.db`), cero configuración, sobrado para una artista con decenas/cientos de obras.
- **Imágenes como archivos WebP** en `uploads/`.

**Optimización automática de cada imagen que sube la artista:**
- Se convierte a **WebP** (calidad 80) → normalmente 85-95 % más ligera que el JPG/PNG original.
- Se generan **varios tamaños** (480 / 960 / 1600 / 2400 px, nunca agranda) y el navegador descarga el que le toca (`srcset`): el celular no baja la imagen de 2400 px.
- Se **borra el EXIF** (ubicación GPS, cámara) y se corrige la rotación de fotos de celular.
- Se valida que sea una imagen real (no se confía en la extensión), máximo 25 MB.
- Archivos con nombre único → caché del navegador de 1 año (`immutable`), carga instantánea en visitas repetidas.
- Se borran solas las imágenes que ya no se usan.

**Si el proyecto crece** (muchas visitas, varios editores, hosting sin disco persistente):
**PostgreSQL (Supabase/Neon) + almacenamiento de objetos (Cloudflare R2 o Supabase Storage) con CDN.** Solo habría que cambiar `server/db.js` (consultas) y `server/images.js` (dónde se escriben los archivos); el dashboard y la landing no cambian.

## Hosting

Necesita un servidor Node con **disco persistente** (para `data/` y `uploads/`): Railway, Render (con disk), Fly.io (volume) o un VPS. **GitHub Pages no sirve** (no ejecuta backend).
En producción: `NODE_ENV=production`, HTTPS, y si estás detrás de un proxy `TRUST_PROXY=1`.
Haz respaldo periódico de las carpetas `data/` y `uploads/`.

## Seguridad incluida

- Contraseñas con **scrypt** + sal; sesión en cookie **HttpOnly + SameSite=Strict** (+ Secure en HTTPS) firmada con HMAC, 7 días; cambiar la contraseña cierra las demás sesiones.
- **Límite de intentos** de login (8 fallidos / 15 min por IP).
- Protección **CSRF** (cabecera personalizada + verificación de origen).
- Todo el contenido se inserta con `textContent`/atributos (sin `innerHTML` con datos editables) → sin XSS.
- Cabeceras: CSP (estricta en `/admin`), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy.
- Sin dependencias de terceros más allá de `sharp`.

## Estructura

```
server/        index.js (API + estáticos) · db.js · images.js · auth.js · schema.js (qué es editable)
public/        index.html · galeria.html · css/ · js/ (cms.js hidrata la landing)
public/admin/  dashboard (HTML + CSS + JS sin build)
data/          icca.db (se crea sola)      uploads/  imágenes optimizadas (se crea sola)
```

**Agregar un campo editable nuevo:** 1) añadirlo en `server/schema.js`, 2) ponerle `data-cms="clave"` (texto) o `data-cms-img="clave"` (imagen) al elemento en el HTML. El dashboard lo muestra solo.

## Notas de la migración de tu landing original

- La galería ya no usa las obras de ejemplo (Mona Lisa, etc.): ahora lee las obras de la base de datos. Vienen 3 obras demo con tu imagen para que las reemplace.
- Se quitaron los `ondragstart` inline y la meta CSP del HTML (ahora las cabeceras las pone el servidor); la protección anti-arrastre sigue en `class.js`.
- Las páginas `kit_ui.html` y `flashcard.html` no se incluyeron (eran de prueba).
# ICCA
