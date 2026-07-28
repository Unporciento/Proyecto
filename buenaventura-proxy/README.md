# Proxy gratuito de Profesor Buenaventura

Worker stateless para llamar exclusivamente a `gemini-3.5-flash-lite` en el
proyecto Gemini API Free Tier de FORJA. No contiene almacenamiento, historial,
sincronización ni rutas académicas.

## Configuración previa al despliegue

1. Confirme en AI Studio que el proyecto `Forja` continúa en `Free` y sin
   facturación.
2. Cree una cuenta Cloudflare en Workers Free sin activar Workers Paid.
3. Configure `ALLOWED_ORIGINS` con el origen exacto de GitHub Pages y, solo
   durante pruebas, el origen local.
4. Ejecute `npx wrangler secret put GEMINI_API_KEY` e introduzca la clave
   directamente en el prompt de Wrangler. Nunca la escriba en un archivo.
5. Despliegue primero en una URL de prueba. No configure
   `BUENAVENTURA_PROXY_URL` ni la CSP de producción sin aprobación final.

El modelo está fijado en código y configuración. Cualquier otro valor devuelve
`provider_unavailable`. Al agotarse Gemini o Workers Free, FORJA conserva todas
sus funciones locales mediante `UnavailableProvider`.
