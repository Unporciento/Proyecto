# AI handoff — FORJA

Estado preparado: Módulo 6 — Presentaciones.

## Estado técnico

- PWA estática con IndexedDB v3 y nueve stores.
- Interfaz visible: Proyectos, Fuentes, Rúbricas, Evidencias, Informes y Presentaciones.
- Toda operación académica pasa por `AcademicRepository`.
- Contratos visibles esquema 2; registros internos esquema 1 siguen compatibles.
- Respaldos v1 y v2 compatibles.
- `SYNC_ENDPOINT = ''`; nube y Worker remoto inactivos.
- `app.js`, Service Worker, migraciones, bóveda y autenticación no cambiaron en
  los módulos académicos visibles.
- Suite completa actual: 89 pruebas.

## Archivos académicos

- Contratos: `js/academic/artifact-schemas.js`.
- Fachada: `js/academic/academic-repository.js`.
- Dominio y persistencia por módulo: `js/academic/*-model.js` y
  `js/academic/*-repository.js`.
- Interfaz por módulo: `js/projects/`, `js/sources/`, `js/rubrics/`,
  `js/evidence/`, `js/reports/`, `js/presentations/`.
- Decisiones duraderas: `docs/ACADEMIC_CORE_ARCHITECTURE.md`.

## Verificación

```bash
npm run verify:quick -- presentations
npm run verify
```

`verify:quick` acepta los módulos académicos visibles, incluido `presentations`.
La verificación completa es obligatoria antes de publicar.

## Próximo paso

- Publicar Presentaciones en rama y commit propios.
- Después continuar con el Módulo UX.
- Profesor FORJA permanece bloqueado.

## Riesgos abiertos

- Medir rendimiento y formularios en Safari iPhone real.
- Los recursos nuevos quedan disponibles offline después de una primera carga
  completa con conexión, porque el Service Worker no se modificó.
- Evaluar alojamiento propio de dependencias CDN en un hito de seguridad.
