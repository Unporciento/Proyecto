# AI handoff — FORJA

Estado preparado: Módulo UX — Identidad y experiencia.

## Estado técnico

- PWA estática con IndexedDB v3 y nueve stores.
- Interfaz visible: Proyectos, Fuentes, Rúbricas, Evidencias, Informes y Presentaciones.
- Toda operación académica pasa por `AcademicRepository`.
- Contratos visibles esquema 2; registros internos esquema 1 siguen compatibles.
- Respaldos v1 y v2 compatibles.
- `SYNC_ENDPOINT = ''`; nube y Worker remoto inactivos.
- `app.js`, Service Worker, migraciones, bóveda y autenticación no cambiaron en
  los módulos académicos visibles.
- Producto visible: `2.0.0`; Service Worker: `2026.07.26-5`.
- Suite completa actual: 94 pruebas.

## Archivos académicos

- Contratos: `js/academic/artifact-schemas.js`.
- Fachada: `js/academic/academic-repository.js`.
- Dominio y persistencia por módulo: `js/academic/*-model.js` y
  `js/academic/*-repository.js`.
- Interfaz por módulo: `js/projects/`, `js/sources/`, `js/rubrics/`,
  `js/evidence/`, `js/reports/`, `js/presentations/`.
- Experiencia global: `js/ux/`, `css/ux.css`, `404.html`, `offline.html`.
- Decisiones duraderas: `docs/ACADEMIC_CORE_ARCHITECTURE.md`.

## Verificación

```bash
npm run verify:quick -- ux
npm run verify
```

`verify:quick` acepta los módulos académicos y `ux`.
La verificación completa es obligatoria antes de publicar.

## Próximo paso

- Publicar UX en rama y commit propios.
- Después continuar con el Módulo Laboratorio.
- Profesor FORJA permanece bloqueado.

## Riesgos abiertos

- Medir rendimiento y formularios en Safari iPhone real.
- Los recursos nuevos quedan disponibles offline después de una primera carga
  completa con conexión, porque el Service Worker no se modificó.
- Evaluar alojamiento propio de dependencias CDN en un hito de seguridad.
