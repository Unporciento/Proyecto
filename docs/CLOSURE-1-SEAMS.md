# Módulo de cierre 1 — Correcciones de costuras

Estado: implementación técnica pendiente de validación manual.
Base: `45e9ba18ed829a28c1d4254ce221e4aad0b8b341`

## Alcance

- El Simulacro exige una confianza de 1 a 5 por respuesta y conserva su duración.
- Calibración usa esos intentos para detectar seguridad alta con resultado bajo.
- Diez preguntas quedan declaradas como valor predeterminado.
- Tipos y estados de evidencias conservan sus identificadores y obtienen sus
  etiquetas de un único catálogo.
- Proyectos explica el flujo Biblioteca → Fuente → Rúbrica y criterio →
  Evidencia → Informe mediante una lista accesible.
- `docs/VERSIONING.md` separa edición, aplicación, base, caché y respaldo sin
  renumerar producto, IndexedDB ni respaldos.
- Service Worker `2026.07.26-6` precarga los tres módulos nuevos requeridos por
  el shell. Las demás versiones técnicas permanecen intactas.

## Compatibilidad

No cambian IndexedDB, contratos de respaldo, migraciones, relaciones académicas,
bóveda ni sincronización. Los intentos anteriores con confianza `0` siguen siendo
válidos: simplemente no participan en el cálculo de alta confianza.

## Fuera de alcance

Buenaventura, Tura, Laboratorio, sincronización remota, optimización global y
rediseño. El trabajo WIP del Laboratorio se conserva fuera de esta rama.

## Riesgos

- Un simulacro interrumpido por tiempo conserva únicamente respuestas enviadas,
  igual que antes.
- El flujo y los controles deben comprobarse con teclado y pantalla estrecha.
- La estrategia de versiones no puede aplicarse sin aprobación explícita.
