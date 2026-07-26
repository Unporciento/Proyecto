# AI handoff — FORJA

Última etapa preparada para producción: hotfix del puente 2A, 2026-07-26.

## Hotfix Etapa 2A

- Service worker `2026.07.26-3`: la copia destinada a caché se crea de inmediato,
  antes de exponer la respuesta de red al consumidor.
- La escritura asíncrona usa `event.waitUntil()` y no bloquea `respondWith()`.
- Se preservan network-first, navegación offline y caché de recursos estáticos.
- El objetivo de base continúa en v2; v3, sincronización e interfaz académica
  permanecen inactivos.

## Estado

- FORJA sigue siendo una PWA estática centrada en estudio.
- El primer flujo académico está implementado solo como dominio, repositorio y pruebas.
- No existe interfaz académica y no se implementaron investigación, presentaciones, IA, calendario, colaboración ni exportación documental.
- `SYNC_ENDPOINT` está vacío: la nube no está activa.
- Bóvedas portátiles v1 siguen compatibles.
- IndexedDB objetivo efectivo de producción continúa en v2.
- `ACADEMIC_DB_VERSION = 3` existe únicamente para migraciones y pruebas aisladas.
- Una base v2 normal no crea stores académicos.
- Verificación actual: 42 pruebas aprobadas, sintaxis válida y todos los archivos propios bajo 400 líneas.

## Núcleo académico

- Stores: `academicProjects`, `projectArtifacts`, `artifactRelations`, `artifactRevisions`.
- Contratos habilitados: `source`, `document_ref`, `rubric`, `rubric_criterion`, `evidence`, `report`, `report_section`.
- Escrituras y consultas: `js/academic/academic-repository.js`.
- Migración y puente: `js/academic/academic-migrations.js`.
- Respaldo v2: `js/academic/backup-v2.js`; los respaldos v1 se convierten en memoria.
- `app.js` no fue modificado.
- No cambiar `TARGET_DB_VERSION` de 2 a 3 hasta aprobar físicamente la Etapa 2A.

## Decisiones de seguridad

- `accountIdentity(code, password)` deriva identidad y token remotos de ambas credenciales.
- `accountSecret(code, password)` no cambió para conservar bóvedas existentes.
- La sesión se crea únicamente después de descifrar, validar, confirmar y restaurar.
- Respaldo local: 10 MB. Bóveda cifrada y Worker: 16 MB.
- La CSP no usa comodines. `https://forja-sync.invalid` es un marcador que debe sustituirse por el origen real.
- El Worker almacena solo el sobre cifrado y controla revisiones optimistas.

## Archivos clave nuevos

- `js/account-restore.js`: flujo restaurable y comprobable sin DOM.
- `js/config.js`: límites compartidos por frontend y Worker.
- `tests/account.test.js`, `tests/db.test.js`, `tests/resources.test.js`, `tests/service-worker.test.js`, `tests/worker.test.js`.

## Restauración

Respaldo anterior a la fase:

`../backups/forja-before-stabilization-2026-07-26.tar.gz`

SHA-256:

`2d5e553443999508c440087eb141a45e627a1e9e0ba96da2020b6f2a44312c92`

## Verificación

```bash
npm install
npm run verify
python3 -m http.server 4173
```

## Antes de activar la nube

1. Desplegar D1 y Worker.
2. Copiar el endpoint HTTPS exacto a `js/sync-config.js`.
3. Reemplazar `https://forja-sync.invalid` en la CSP de `index.html`.
4. Configurar `ALLOWED_ORIGINS` con el origen exacto de GitHub Pages.
5. Repetir pruebas de creación, otro dispositivo, conflicto y pérdida de red.

## Pendiente

- Validación visual/manual en Brave o Chrome de computador y Safari iPhone.
- Interfaz de resolución de conflictos entre dispositivos.
- Decidir alojamiento local o CDN de PDF.js, Mammoth, Tesseract y fuentes.
- Aprobar la prueba vertical interna antes de diseñar cualquier interfaz.
- Medir el volumen en Safari iPhone y Chrome/Brave reales; `fake-indexeddb` no representa hardware móvil.
- Para 2B: cambiar únicamente el objetivo efectivo a 3, actualizar caché/documentación,
  repetir migración, respaldo, rollback y pruebas reales antes de publicar.
