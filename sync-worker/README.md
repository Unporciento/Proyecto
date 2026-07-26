# Forja Sync Worker

Backend mínimo para almacenar únicamente bóvedas cifradas. Código y contraseña juntos generan la identidad y autorización remotas. La contraseña nunca sale del navegador.

## Despliegue

1. Crear la base: `npx wrangler d1 create forja-sync`.
2. Copiar el `database_id` resultante en `wrangler.jsonc`.
3. Aplicar el esquema: `npx wrangler d1 execute forja-sync --remote --file=schema.sql`.
4. Publicar: `npx wrangler deploy`.
5. Copiar la URL `workers.dev` en `../js/sync-config.js`.
6. Sustituir `https://forja-sync.invalid` en la CSP de `../index.html` por ese mismo origen exacto.
7. Volver a publicar Forja y comprobar CORS desde el dominio de GitHub Pages.

No se almacenan contraseñas, documentos legibles ni claves de descifrado. Conviene activar Rate Limiting en Cloudflare para la ruta `/v1/vaults/*` antes de abrir el servicio a más usuarios.
