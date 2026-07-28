# AI handoff — FORJA

Estado preparado: Módulo de cierre 2 — Arquitectura canónica de Buenaventura.

## Estado técnico

- PWA estática con IndexedDB v3 y nueve stores.
- Interfaz visible: Proyectos, Fuentes, Rúbricas, Evidencias, Informes y Presentaciones.
- Toda operación académica pasa por `AcademicRepository`.
- Contratos visibles esquema 2; registros internos esquema 1 siguen compatibles.
- Respaldos v1 y v2 compatibles.
- `SYNC_ENDPOINT = ''`; nube y Worker remoto inactivos.
- `app.js`, Service Worker, migraciones, bóveda y autenticación no cambiaron en
  los módulos académicos visibles.
- Producto visible: `2.0.0`; IndexedDB: `3`; Service Worker:
  `2026.07.26-6`; respaldo: `2`. Solo avanzó el Service Worker para precargar
  los nuevos módulos del cierre.
- Simulacro conserva confianza real y Calibración consume el mismo dato.
- Etiquetas de evidencia centralizadas sin cambiar identificadores persistidos.
- Suite completa actual: 101 pruebas.

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
npm run verify:quick -- closure1
npm run verify
```

`verify:quick` acepta los módulos académicos, `ux` y `closure1`.
La verificación completa es obligatoria antes de publicar.

## Buenaventura

- La fuente canónica es `docs/buenaventura/00_CANON.md`; sus documentos anexos
  separan voz, pedagogía, memoria, permisos, seguridad y pruebas.
- No existe implementación funcional: sin interfaz, proveedor, chat, memoria,
  adaptadores ejecutables ni escrituras académicas.
- El diseño futuro solo permite `OBSERVE` y `RECOMMEND`, con contexto mínimo y
  adaptadores de solo lectura para Biblioteca, Rúbricas, Evidencias e Informes.

## Próximo paso

- Esperar validación del Módulo de cierre 2 antes de cualquier implementación de
  Buenaventura. No iniciar el Módulo de cierre 3.
- Laboratorio permanece aplazado y su WIP está fuera de la rama activa.

## Riesgos abiertos

- Medir rendimiento y formularios en Safari iPhone real.
- Los recursos nuevos quedan disponibles offline después de una primera carga
  completa con conexión, porque el Service Worker no se modificó.
- Evaluar alojamiento propio de dependencias CDN en un hito de seguridad.
- La estrategia de `docs/VERSIONING.md` está propuesta, no aplicada.
