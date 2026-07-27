# Módulo 5 — Informes

Estado: implementado técnicamente  
Fecha: 2026-07-26

## Alcance

Cada proyecto admite un informe con secciones ordenadas. El informe puede estar
en borrador o final; no genera texto, corrige, predice notas ni exporta archivos.

## Frontera

La interfaz vive en `js/reports/` y entra por `AcademicRepository.reports()`.
`ReportRepository` realiza las operaciones multistore; ningún archivo visual usa
IndexedDB directamente. No se añadió store ni migración.

## Contratos

- `report`, esquema 2: título, resumen, idioma y estado cerrado.
- `report_section`, esquema 2: encabezado, cuerpo y posición.
- `derived_from`: la sección utiliza una evidencia del mismo proyecto.
- `cites`: la sección cita una fuente registrada del mismo proyecto.

Al guardar se validan proyecto, informe, padres, extremos, tipos y pertenencia.
La actualización reemplaza secciones y relaciones propias en una transacción.

## Autoguardado e historial

El cuerpo se autoguarda tras una pausa breve. Cada pulsación actualiza el
borrador actual, pero no crea revisiones. Al cambiar de borrador a final se crea
un hito `submitted` del informe y cada sección.

## Cobertura

La cobertura se deriva sin duplicar datos:

`sección → evidencia → criterio`.

La interfaz muestra criterios cubiertos frente al total de la rúbrica.

## Riesgos

- La edición simultánea en varias pestañas no tiene resolución de conflictos.
- Los recursos nuevos quedan offline después de su primera carga conectada.
- Falta validación física del autoguardado y teclado en Safari iPhone.
