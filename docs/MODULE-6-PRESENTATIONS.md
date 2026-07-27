# Módulo 6 — Presentaciones

Estado: implementado técnicamente  
Fecha: 2026-07-26

## Alcance

Prepara el contenido académico de una exposición asociada a un proyecto. No
implementa el motor visual, cámara, gestos, control remoto ni efectos de NEXUS.

## Frontera

La interfaz vive en `js/presentations/` y entra por
`AcademicRepository.presentations()`. No usa IndexedDB directamente ni añade
stores o migraciones.

## Contratos

- `presentation`: título, objetivo, público, estado y versión del paquete.
- `presentation_slide`: título, contenido, notas, estado y posición.
- `derived_from`: diapositiva → sección del informe o evidencia.
- `cites`: diapositiva → fuente.

La creación, edición, orden y eliminación son transacciones atómicas. Todos los
extremos deben existir dentro del mismo proyecto.

## Paquete NEXUS

El botón `Paquete para NEXUS` descarga JSON local con formato
`forja-nexus-package`, versión 1. Incluye proyecto, presentación, diapositivas y
los identificadores de sus vínculos. No envía datos ni intenta renderizar la
presentación.

## Riesgos

- NEXUS Present todavía no consume este contrato.
- La exportación contiene el contenido académico elegido por el usuario y debe
  compartirse conscientemente.
- Falta validación física de formularios extensos en Safari iPhone.
