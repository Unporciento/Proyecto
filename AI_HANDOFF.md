# AI handoff — FORJA

Estado preparado: Módulo 4 — Evidencias.  
Base de producción anterior: Módulo 3, commit
`4b8145bdb48e92b6ade07cb117a1b0bfeb09a8e1`.

## Estado técnico

- PWA estática con IndexedDB v3 y nueve stores.
- Interfaz visible: Proyectos, Fuentes, Rúbricas y Evidencias.
- Toda operación académica pasa por `AcademicRepository`.
- Contratos visibles esquema 2; registros internos esquema 1 siguen compatibles.
- Respaldos v1 y v2 compatibles.
- `SYNC_ENDPOINT = ''`; nube y Worker remoto inactivos.
- `app.js`, Service Worker, migraciones, bóveda y autenticación no cambiaron en
  los módulos académicos visibles.
- Suite completa actual: 73 pruebas.

## Archivos académicos

- Contratos: `js/academic/artifact-schemas.js`.
- Fachada: `js/academic/academic-repository.js`.
- Dominio y persistencia por módulo: `js/academic/*-model.js` y
  `js/academic/*-repository.js`.
- Interfaz por módulo: `js/projects/`, `js/sources/`, `js/rubrics/`,
  `js/evidence/`.
- Decisiones duraderas: `docs/ACADEMIC_CORE_ARCHITECTURE.md`.

## Verificación

```bash
npm run verify:quick -- evidence
npm run verify
```

`verify:quick` acepta `projects`, `sources`, `rubrics` o `evidence`. La verificación
completa es obligatoria antes de publicar.

## Próximo paso

- Terminar publicación y validación manual de Evidencias.
- No comenzar Módulo 5 — Informes sin aprobación explícita.
- Laboratorio permanece reservado para una fase futura.

## Riesgos abiertos

- Medir rendimiento y formularios en Safari iPhone real.
- Los recursos nuevos quedan disponibles offline después de una primera carga
  completa con conexión, porque el Service Worker no se modificó.
- Evaluar alojamiento propio de dependencias CDN en un hito de seguridad.
