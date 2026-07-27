# Módulo 4 — Evidencias

Estado: implementado; publicación técnica pendiente  
Fecha: 2026-07-26

## Alcance

El módulo registra qué demuestra una evidencia, de dónde proviene y qué criterio
intenta satisfacer. No implementa informe, IA, OCR nuevo, evaluación automática,
predicción de nota, presentaciones ni citas.

## Frontera

La interfaz vive en `js/evidence/` y utiliza `AcademicRepository`. No se añadió
store ni migración.

## Contrato

El esquema 2 contiene título, descripción, observación técnica, fecha, tipo y
estado. Tipos permitidos:

- texto u observación;
- referencia documental;
- fotografía existente;
- resultado técnico;
- procedimiento;
- hallazgo;
- cálculo;
- tabla o registro.

Estados: `collected`, `review`, `approved` y `discarded`. El esquema 1 permanece
legible y se convierte al editar.

## Trazabilidad

```text
Fuente
  ← evidence derived_from source
Evidencia
  → evidence satisfies criterion
Criterio
```

La interfaz presenta esta estructura en lenguaje natural:

```text
Fuente → sustenta Evidencia → satisface Criterio
```

Cada evidencia exige al menos una fuente y un criterio. Se permiten varias
relaciones de cada tipo, sin duplicados.

## Integridad y archivos

- Proyecto, fuentes, criterios, rúbrica y documentos deben existir.
- Todos los extremos deben pertenecer al mismo proyecto.
- El criterio debe ser hijo de la rúbrica del proyecto.
- Documento y fotografía requieren un archivo de la asignatura.
- `document_ref` evita duplicar el archivo.
- Evidencia, referencia y relaciones se guardan en una transacción.
- Un fallo mantiene la base intacta.
- Eliminar evidencia limpia sus relaciones y referencia académica, pero conserva
  documento, fuente, rúbrica y criterio.

## Rendimiento y accesibilidad

El listado utiliza `projectKind`; las relaciones usan `projectId`, `fromId` y
`toId`. Se muestran 60 tarjetas por página. La prueba consulta y filtra 500
evidencias con umbral de un segundo en `fake-indexeddb`.

En móvil hay una columna, formulario desplazable con `100dvh`, listas de selección
con controles nativos y acciones táctiles. El foco vuelve al control que abrió el
diálogo y los errores se anuncian mediante `role="alert"`.

No comenzar el Módulo 5 — Informes sin aprobación explícita.
