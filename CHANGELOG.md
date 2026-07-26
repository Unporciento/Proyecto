# Changelog

## 2026-07-26 — Estabilización de cuentas y datos

### Corregido

- Cancelar una restauración ya no deja la cuenta marcada como desbloqueada.
- Una restauración fallida en IndexedDB aborta toda la transacción y conserva los datos anteriores.
- La autorización remota ahora depende de código y contraseña juntos.
- CORS ya no responde con un origen permitido cuando la solicitud proviene de un origen desconocido.
- El límite remoto sube a 16 MB para admitir cualquier respaldo local aceptado de hasta 10 MB después de cifrado y Base64.

### Cambiado

- Se eliminaron los query strings de versión repetidos en HTML e imports.
- El caché de la PWA tiene una única versión en `service-worker.js`.
- La CSP incluye un marcador cerrado para el futuro origen exacto de sincronización.
- Se añadió `fake-indexeddb` únicamente como dependencia de desarrollo.
- `npm run verify` ejecuta sintaxis, pruebas y límite de 400 líneas.

### Pruebas

- 25 pruebas aprobadas: lógica previa, cuenta, bóveda, límites, IndexedDB, restauración atómica, recursos, CSP, service worker y Worker.
- El Worker también completa el empaquetado real de Wrangler en modo `--dry-run`.

### Compatibilidad

- Sin cambios en el esquema IndexedDB.
- Las bóvedas portátiles v1 existentes continúan siendo legibles.
- La sincronización remota continúa desactivada hasta desplegar y configurar el Worker.
