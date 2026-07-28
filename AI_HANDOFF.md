# AI handoff — FORJA

Estado preparado: Módulo de cierre 3 — Profesor Buenaventura MVP.

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
- Suite completa actual: 115 pruebas.

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
npm run verify:quick -- closure3
npm run verify
```

`verify:quick` acepta los módulos académicos, `ux`, `closure1` y `closure3`.
La verificación completa es obligatoria antes de publicar.

## Buenaventura

- La fuente canónica es `docs/buenaventura/00_CANON.md`; sus documentos anexos
  separan voz, pedagogía, memoria, permisos, seguridad y pruebas.
- El MVP ofrece interfaz efímera, selección explícita, vista previa y contratos
  versionados para `OBSERVE` y `RECOMMEND`.
- `compare` combina fragmentos de distintos módulos únicamente dentro del mismo
  proyecto; cada fragmento conserva módulo, `projectId` y procedencia.
- Los adaptadores usan transacciones de solo lectura para Biblioteca, Rúbricas,
  Evidencias e Informes. El orquestador no recibe `AcademicRepository`.
- `UnavailableProvider` es el proveedor predeterminado. No hay proveedor
  comercial, endpoint, credenciales, memoria, historial ni escritura académica.

## Próximo paso

- Esperar revisión y aprobación del Módulo de cierre 3. No iniciar un módulo de
  cierre posterior ni elegir proveedor sin aprobación.
- Laboratorio permanece aplazado y su WIP está fuera de la rama activa.

## Riesgos abiertos

- Medir rendimiento y formularios en Safari iPhone real.
- Los recursos nuevos quedan disponibles offline después de una primera carga
  completa con conexión, porque el Service Worker no se modificó.
- Evaluar alojamiento propio de dependencias CDN en un hito de seguridad.
- La estrategia de `docs/VERSIONING.md` está propuesta, no aplicada.
