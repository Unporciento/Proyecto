# Proxy gratuito de Profesor Buenaventura

Worker stateless que llama exclusivamente a `gemini-3.5-flash-lite` mediante
Gemini API Free Tier. No contiene almacenamiento, historial, sincronización ni
rutas académicas. Su única ruta es `/v1/buenaventura/recommend`.

## 1. Comprobaciones previas

- En Google AI Studio, proyecto `Forja`: `Usage tier: Free` y facturación no
  configurada.
- En Cloudflare: plan `Free`; no seleccione `Workers Paid` ni introduzca tarjeta.
- En `wrangler.jsonc`, conserve `workers_dev: true`. No añada KV, D1, R2,
  Durable Objects, Queues ni rutas de producción.

## 2. Crear el Worker de prueba

Abra PowerShell en la carpeta `buenaventura-proxy` y ejecute:

```powershell
npx.cmd wrangler@latest login
npx.cmd wrangler@latest deploy
```

El primer despliegue no tiene la clave y responderá `provider_unavailable`.
Wrangler mostrará una dirección similar a:

```text
https://forja-buenaventura-free.<subdominio>.workers.dev
```

Esta es una URL de prueba en `workers.dev`, no la activación de FORJA.

## 3. Añadir el secreto

Desde la misma carpeta:

```powershell
npx.cmd wrangler@latest secret put GEMINI_API_KEY
```

Pegue la clave solamente cuando Wrangler muestre el prompt interactivo. No la
escriba en comandos, archivos, capturas ni conversaciones. Cloudflare crea una
nueva versión del Worker con el secreto cifrado.

Alternativa en el panel: **Workers & Pages → forja-buenaventura-free → Settings
→ Variables and Secrets → Add → Secret**. Nombre: `GEMINI_API_KEY`.

## 4. Prueba sintética

Sustituya `<URL_WORKER>` por la URL base entregada por Wrangler:

```powershell
$body = @{
  schemaVersion = 'buenaventura-proxy-request-v1'
  task = 'compare'
  activeEvaluation = $false
  consent = @{
    externalProvider = $true
    deidentified = $true
    adultUse = $true
  }
  fragments = @(
    @{
      alias = 'F1'
      module = 'rubric'
      kind = 'rubric_criterion'
      excerpt = 'El informe distingue observaciones, resultados y conclusiones.'
    },
    @{
      alias = 'F2'
      module = 'evidence'
      kind = 'evidence'
      excerpt = 'El equipo registró tres mediciones y explicó dos diferencias.'
    },
    @{
      alias = 'F3'
      module = 'report'
      kind = 'report_section'
      excerpt = 'Los resultados muestran variación; falta relacionarla con el criterio.'
    }
  )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Method Post `
  -Uri '<URL_WORKER>/v1/buenaventura/recommend' `
  -Headers @{ Origin = 'http://localhost:8000' } `
  -ContentType 'application/json' `
  -Body $body
```

La respuesta debe tener `schemaVersion: buenaventura-proxy-response-v1`,
`status: ok`, texto de observaciones/recomendaciones y referencias F1-F3.

## 5. Preparar FORJA sin activar producción

No cambie todavía estos archivos. Después de la aprobación final:

1. Cambie `ALLOWED_ORIGINS` a `https://unporciento.github.io` y redespliegue.
2. Copie la URL completa, incluida la ruta:
   `https://...workers.dev/v1/buenaventura/recommend`.
3. Asígnela a `BUENAVENTURA_PROXY_URL` en
   `js/buenaventura/buenaventura-config.js`.
4. Añada solo el origen `https://...workers.dev` a `connect-src` en la CSP de
   `index.html`.
5. Ejecute `verify:quick`, `npm run verify` y solicite aprobación para publicar.

Mientras `BUENAVENTURA_PROXY_URL` esté vacío, FORJA usa `UnavailableProvider`.
Al agotarse Gemini o Workers Free no existe fallback pagado.

## 6. Confirmar nivel gratuito

En Cloudflare abra **Workers & Pages → Overview → Usage** y confirme que la
cuenta indica `Workers Free`. En **Billing → Subscriptions** no debe aparecer
`Workers Paid` ni el cargo mínimo mensual. El plan Free limita el Worker en vez
de generar sobreuso facturable.

En Google AI Studio vuelva a confirmar `Usage tier: Free` y facturación no
configurada después de la prueba.
