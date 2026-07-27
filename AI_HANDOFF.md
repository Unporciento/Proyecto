# AI handoff — FORJA

Último módulo preparado para producción: Módulo 3 — Rúbricas, 2026-07-26.

## Módulos visibles

- La sección visible `Proyectos` permite crear, editar, archivar y eliminar.
- El contrato visible usa `PROJECT_SCHEMA_VERSION = 2` y valida fechas, estado,
  color, icono, progreso y duplicados por asignatura.
- Cada tarjeta abre sus fuentes: crear, editar y eliminar PDF, Word, imagen,
  enlace, libro, artículo, apunte o video.
- Las fuentes nuevas usan `SOURCE_SCHEMA_VERSION = 2`; el esquema 1 sigue legible.
- Cada proyecto admite una rúbrica con criterios editables, orden accesible,
  puntaje derivado, obligatoriedad y cuatro estados cerrados.
- Rúbricas y criterios visibles usan `RUBRIC_SCHEMA_VERSION = 2`; el esquema 1
  sigue legible.
- La interfaz vive en `js/projects/`, `js/sources/` y `js/rubrics/` y usa
  exclusivamente `AcademicRepository`.
- Evidencias, informes y demás módulos siguen sin interfaz.

## Estado

- FORJA sigue siendo una PWA estática centrada en estudio.
- Proyectos Académicos, Fuentes y Rúbricas tienen interfaz visible.
- No se implementaron interfaces de evidencias, informes, presentaciones,
  profesor IA, laboratorio, colaboración ni exportación documental.
- `SYNC_ENDPOINT` está vacío: la nube no está activa.
- Bóvedas portátiles v1 siguen compatibles.
- IndexedDB objetivo efectivo de producción: v3.
- `ACADEMIC_DB_VERSION = 3`.
- Verificación actual: 65 pruebas aprobadas, sintaxis válida y todos los archivos propios bajo 400 líneas.

## Núcleo académico

- Stores: `academicProjects`, `projectArtifacts`, `artifactRelations`, `artifactRevisions`.
- Contratos habilitados: `source`, `document_ref`, `rubric`, `rubric_criterion`, `evidence`, `report`, `report_section`.
- Escrituras y consultas: `js/academic/academic-repository.js`.
- Migración y puente: `js/academic/academic-migrations.js`.
- Respaldo v2: `js/academic/backup-v2.js`; los respaldos v1 se convierten en memoria.
- `app.js` no fue modificado.
- Módulo 4 autorizado únicamente después de publicar y verificar técnicamente Rúbricas.

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
- Medir el volumen en Safari iPhone y Chrome/Brave reales; `fake-indexeddb` no representa hardware móvil.
- El Laboratorio es obligatorio en una fase futura: diagnóstico pasivo, informe
  copiable, salud calculada, historial local y reparaciones solo autorizadas.
