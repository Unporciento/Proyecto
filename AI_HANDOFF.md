# AI handoff — FORJA

Producción actual: Módulo 3 — Rúbricas, commit
`4b8145bdb48e92b6ade07cb117a1b0bfeb09a8e1`.

## Estado técnico

- PWA estática con IndexedDB v3 y nueve stores.
- Interfaz visible: Proyectos, Fuentes y Rúbricas.
- Toda operación académica pasa por `AcademicRepository`.
- Contratos visibles esquema 2; registros internos esquema 1 siguen compatibles.
- Respaldos v1 y v2 compatibles.
- `SYNC_ENDPOINT = ''`; nube y Worker remoto inactivos.
- Suite completa publicada: 65 pruebas.

## Archivos académicos

- Contratos: `js/academic/artifact-schemas.js`.
- Fachada: `js/academic/academic-repository.js`.
- Dominio y persistencia: `js/academic/*-model.js` y
  `js/academic/*-repository.js`.
- Decisiones duraderas: `docs/ACADEMIC_CORE_ARCHITECTURE.md`.

## Verificación

```bash
npm run verify:quick -- evidence
npm run verify
```

`verify:quick` acepta `projects`, `sources`, `rubrics` o `evidence`.
La verificación completa es obligatoria antes de publicar.

## Próximo paso

- Completar Módulo 4 — Evidencias en rama y commit independientes.
- No comenzar Módulo 5 — Informes sin aprobación explícita.
- Laboratorio permanece reservado para una fase futura.

## Riesgos abiertos

- Medir rendimiento y formularios en Safari iPhone real.
- Evaluar alojamiento propio de dependencias CDN en un hito de seguridad.
