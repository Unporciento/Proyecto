# Módulo 2 — Fuentes

Estado: implementado y aprobado tras validación manual  
Fecha: 2026-07-26

## Alcance

Este módulo permite registrar material de apoyo dentro de un proyecto. Admite PDF,
Word, imagen, enlace web, libro, artículo, apunte propio y video. No implementa
citas, APA, bibliografía, IA, OCR, análisis ni resúmenes.

## Arquitectura

```text
projects-view.js
  └─ sources-controller.js
       ├─ source-form.js
       ├─ sources-view.js
       └─ AcademicRepository
            ├─ source-model.js
            ├─ source-repository.js
            └─ contratos versionados → IndexedDB v3
```

La interfaz no importa `db.js` ni utiliza `indexedDB`. Los archivos continúan en
la Biblioteca y el módulo guarda un `document_ref` conectado a la fuente mediante
`attached_to`. Así no duplica el contenido.

## Contrato

Las fuentes visibles usan `SOURCE_SCHEMA_VERSION = 2`. Conservan título, tipo,
descripción, autor, fecha, URL y notas. El validador acepta fuentes esquema 1 de
respaldos anteriores, pero rechaza campos arbitrarios, tipos desconocidos y
versiones futuras.

PDF, Word e imagen requieren un documento existente. Enlace web y video requieren
una URL HTTP o HTTPS. Cualquier otro tipo puede asociar opcionalmente un documento
o enlace.

## Integridad y seguridad

- La fuente siempre pertenece a un proyecto existente.
- Un archivo solo puede elegirse entre documentos de la asignatura del proyecto.
- El repositorio vuelve a comprobar que el documento exista antes de escribir.
- Fuente, referencia y relación se guardan en una transacción multistore.
- Un fallo intermedio aborta toda la operación.
- La edición no permite mover una fuente a otro proyecto.
- Eliminar conserva el documento original de la Biblioteca.
- El contenido se presenta con `textContent`; nunca se interpreta como HTML.
- Los enlaces se validan al escribir y nuevamente al mostrarlos.

## Rendimiento

La lista usa el índice compuesto `projectKind` y páginas de 60 elementos; no carga
la trazabilidad completa del proyecto. La prueba automatizada registra 500 fuentes,
consulta dos páginas y filtra 100 videos. Su umbral es un segundo con
`fake-indexeddb`; la medición no sustituye una prueba física en iPhone.

La lista de documentos se limita a la asignatura del proyecto. IndexedDB v3 no
incluye un índice `subjectId` en `documents`, por lo que esta consulta filtra los
documentos después de leer el store. Añadir un índice exigiría una migración y
queda fuera del alcance autorizado.

## Accesibilidad y móvil

- Formularios etiquetados, validación nativa y error con `role="alert"`.
- Foco inicial y devolución al botón que abrió el diálogo.
- Acciones con nombre accesible que incluye el título de la fuente.
- Resultados y cantidad anunciados mediante regiones vivas.
- Una columna bajo 760 px y controles táctiles de 38–44 px.
- El usuario puede volver al proyecto sin perder la navegación principal.

El Módulo 3 fue autorizado después de la validación manual del usuario.
