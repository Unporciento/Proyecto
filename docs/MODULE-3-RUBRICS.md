# Módulo 3 — Rúbricas

Estado: implementado y publicado técnicamente  
Fecha: 2026-07-26

## Alcance

Cada proyecto puede tener una rúbrica manual con criterios verificables. No existe
extracción automática, OCR, IA, predicción de nota, evaluación automática ni
ponderación inventada.

## Frontera

La interfaz vive en `js/rubrics/` y utiliza `AcademicRepository`. No se añadió
store ni migración: `rubric` y `rubric_criterion` ya pertenecían al núcleo.

## Contratos

El esquema 2 de rúbrica guarda instrucciones, observaciones y total. El esquema 2
de criterio guarda descripción, puntaje máximo, obligatoriedad y uno de estos
estados:

- `pending`;
- `in_progress`;
- `completed`;
- `not_applicable`.

Título y posición permanecen en el contrato común de artefacto. Los esquemas 1 se
mantienen legibles para respaldos anteriores.

## Reglas e integridad

- Solo una rúbrica por proyecto.
- Proyecto y rúbrica deben existir antes de actualizar.
- Cada criterio pertenece al mismo proyecto y a esa rúbrica.
- Título obligatorio y no duplicado dentro de la rúbrica.
- Puntaje numérico entre 0 y 1.000.000.
- Posiciones consecutivas desde cero.
- Total calculado como suma de puntajes, nunca escrito libremente.
- Rúbrica y criterios se escriben en una transacción.
- Un fallo deja la versión anterior intacta.
- Eliminar exige confirmación y limpia criterios y relaciones conectadas.

## Accesibilidad

El reordenamiento usa botones Subir y Bajar, utilizables con teclado y lector de
pantalla. Formularios, errores, foco y retorno al control de origen son explícitos.
En móvil las tarjetas pasan a una columna y los cuatro controles permanecen dentro
del ancho disponible.

## Rendimiento

La rúbrica se localiza con `projectKind` y sus criterios con `parentId`. La prueba
automatizada guarda y consulta 500 criterios con umbral de un segundo en
`fake-indexeddb`. La medición física en Safari iPhone sigue siendo necesaria.

Commit independiente del módulo: `4b8145bdb48e92b6ade07cb117a1b0bfeb09a8e1`.
