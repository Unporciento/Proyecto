# Versionado de FORJA

Estado: estrategia propuesta, todavía no aplicada.
Fecha: 2026-07-28

FORJA utiliza cinco números con responsabilidades distintas. No deben avanzar
juntos ni utilizarse como sustitutos.

| Identificador | Estado actual | Responsabilidad |
| --- | --- | --- |
| Edición pública | Objetivo `FORJA 1.0` | Nombre del hito funcional completo |
| Aplicación | `2.0.0` | Cambios visibles y compatibilidad del frontend |
| IndexedDB | `3` | Estructura física de la base local |
| Service Worker | `2026.07.28-11` | Renovación del shell y de su caché |
| Respaldo | `2` | Contrato JSON exportable y restaurable |

## Estrategia propuesta

1. No reducir `2.0.0` a `1.0.0`. La versión técnica debe ser monótona para que
   soporte, diagnósticos y actualizaciones no confundan una versión nueva con una
   anterior.
2. Tratar `FORJA 1.0` como el nombre público del hito de producto. Al certificarlo,
   la interfaz podrá mostrar ambos identificadores: `FORJA 1.0` y la versión
   técnica de aplicación que corresponda, siempre igual o superior a `2.0.0`.
3. Incrementar la aplicación solo por cambios de producto aprobados:
   parche para correcciones compatibles, menor para capacidad compatible y mayor
   únicamente para ruptura deliberada.
4. Incrementar IndexedDB solo cuando exista una migración aditiva o transformadora
   probada. Un cambio visual nunca debe elevarla.
5. Incrementar el Service Worker en cada publicación que cambie recursos
   necesarios para el funcionamiento offline. No usar su número como versión de
   datos.
6. Incrementar el respaldo solo al cambiar su contrato. Toda versión nueva debe
   conservar restauración de formatos anteriores durante el periodo documentado.

## Condición para aplicarla

La numeración actual permanece intacta hasta aprobación explícita. Antes de la
primera modificación se comprobarán actualización, caché, migración, exportación
y restauración en una instalación existente.
