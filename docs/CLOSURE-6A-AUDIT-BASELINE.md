# Módulo de cierre 6A — Auditoría y línea base

Fecha de medición: 2026-07-28

Base: `4665ccfefe629d490df916bfde8688fcd015f591`

Alcance: observación, medición y pruebas de reproducción. Sin limpieza ni optimización.

## Hechos medidos

### Mapa de conexiones

`index.html` inicia nueve controladores:

1. núcleo local (`app.js`);
2. proyectos;
3. fuentes;
4. rúbricas;
5. evidencias;
6. informes;
7. Buenaventura;
8. presentaciones;
9. experiencia de uso.

El grafo estático alcanza los 77 módulos JavaScript de `js/`. No hay módulos de
producción desconectados. Las conexiones principales son:

- `app.js` → datos locales, sesiones, respaldo, cuenta, sincronización y UI;
- controladores académicos → `AcademicRepository` → stores e índices de IndexedDB;
- Buenaventura → puertos de solo lectura → proveedor desacoplado;
- proveedor Gemini → proxy Cloudflare stateless, con `UnavailableProvider` seguro;
- relación Tura → store mínimo en `settings`, política local e identidad cerrada;
- respaldo v2 → stores legacy, académicos y estado mínimo de relación;
- Service Worker → shell local versionado `2026.07.28-9`.

`sync-worker/` y `buenaventura-proxy/` son entradas de despliegue separadas; no
forman parte del grafo del navegador.

### Inicio y renderizado en GitHub Pages

Entorno: Chrome DevTools, escritorio, red y CPU sin ralentización, página
controlada por Service Worker.

| Medida | Resultado |
| --- | ---: |
| LCP | 788 ms |
| TTFB | 89 ms |
| retraso de renderizado del LCP | 698 ms |
| CLS | 0,0092 |
| DOM interactivo | 158,5 ms |
| DOMContentLoaded | 866,2 ms |
| load | 958,4 ms |
| nodos DOM observados | 890 |
| profundidad máxima informada | 9 |
| scripts cargados | 77 |
| recursos observados | 93 |
| transferencia de recursos | 199.966 bytes |
| tamaño decodificado | 395.708 bytes |
| heap JS usado | 6.862.772 bytes |
| snapshot de heap | 14.202.432 bytes |

El LCP es texto. El 88,6 % de su tiempo corresponde a espera de renderizado. La
ruta crítica máxima fue 830 ms y terminó en la cadena de módulos de
Buenaventura. Se observaron dos recalculaciones grandes de layout: 258 ms y
83 ms. DevTools atribuyó 343 ms de reflow sin función JavaScript superior
identificable.

Google Fonts transfirió 12,1 kB. No se observó ejecución de scripts de terceros.
Las políticas HTTP de GitHub Pages informaron TTL de 600 s, sin ahorro estimado
en esta navegación.

Lighthouse de escritorio y móvil obtuvo 95 en accesibilidad y 100 en buenas
prácticas, SEO y navegación agéntica. Los dos defectos comunes fueron contraste
insuficiente y nombres accesibles que no contienen el texto visible.

### IndexedDB y volumen

- Base instalada: `forja-estudio`, versión 3.
- Stores: cinco legacy y cuatro académicos.
- Respaldo: versión 2.
- Restauración: validación previa y una transacción sobre todos los stores.
- Grafo de 200 proyectos, 20.000 artefactos y 50.000 relaciones:
  carga 18.155,1 ms; consulta indexada 6,8 ms.

Consultas de 500 elementos, una ejecución local:

| Módulo | Tiempo |
| --- | ---: |
| proyectos | 209,3 ms |
| fuentes | 1.142,4 ms |
| rúbricas | 91,6 ms |
| evidencias | 1.471,9 ms |
| informes | 329,4 ms |
| presentaciones | 81,3 ms |

### Segundo plano, batería y animaciones

- El temporizador de enfoque cancela su `setTimeout` al ocultarse y recalcula
  desde una fecha límite al volver.
- Los parsers esperan visibilidad antes de continuar páginas PDF u OCR.
- El modo de energía escucha batería, ahorro de datos, movimiento reducido,
  puntero, memoria y núcleos.
- Con `data-page-hidden`, las animaciones CSS quedan pausadas.
- Con modo ahorro, animaciones y transiciones quedan desactivadas.
- No se pudo provocar un estado `hidden` real desde el navegador CDP aislado:
  esta parte queda limitada a inspección de ciclo de vida y debe medirse en
  dispositivo real durante 6C.

## Problemas confirmados

### P1 — intervalo de simulacro sin cierre al abandonar la vista

`ExamSession` crea un intervalo de un segundo y solo lo libera al finalizar el
simulacro. `startExam()` descarta la instancia y `showView()` permite cambiar de
vista sin notificarla. La prueba 6A reproduce que el intervalo queda activo y
que no existe `dispose()`.

Impacto: actividad de CPU en segundo plano dentro de la aplicación y posible
acumulación si se inician varios simulacros abandonados.

### P2 — shell de instalación incompleto

Los 77 módulos están conectados, pero 29 scripts alcanzables y seis hojas CSS
referenciadas por `index.html` no están en `SHELL`. La estrategia network-first
los guarda después de una respuesta exitosa; no están garantizados por
`cache.addAll()` durante la instalación.

Impacto: una instalación nueva que pierda conectividad antes de una carga
controlada completa puede abrir el HTML y fallar al resolver módulos o estilos.

### P3 — accesibilidad reproducida por Lighthouse

Hay texto con contraste inferior a 4,5:1 y dos controles cuyo nombre accesible
no incluye su texto visible: la marca lateral y el botón de perfil.

Impacto: lectura deficiente y discrepancia para voz/lector de pantalla.
Corrección reservada para 6C, después de la integración 6B.

### P4 — trabajo de renderizado concentrado

Los nueve controladores y sus 77 módulos se evalúan al inicio. La navegación
actual sigue dentro de valores buenos, pero el retraso de renderizado domina el
LCP y existen actualizaciones de layout grandes. No se autoriza optimización sin
una comparación adicional en 6C.

## Código muerto y duplicado

- Módulos JavaScript inalcanzables desde producción: ninguno.
- Grupos de archivos JS/CSS idénticos por SHA-256: ninguno.
- Código eliminado: ninguno.
- No se auditaron como muertos los Workers separados ni recursos dinámicos.

## Presupuestos preliminares

Son límites de no regresión para el mismo entorno, no objetivos de optimización:

- LCP de escritorio ≤ 1.000 ms y CLS ≤ 0,02;
- carga completa ≤ 1.200 ms;
- heap JS inicial ≤ 8 MB;
- transferencia inicial de recursos ≤ 250 kB;
- consulta del grafo grande ≤ 2.000 ms;
- carga sintética grande ≤ 35.000 ms en Windows;
- mantener los límites existentes de cada consulta de 500 elementos.

Se revisarán con repeticiones, red móvil y dispositivos reales en 6C.

## Decisiones de 6A

- No corregir los defectos P1–P4 en esta entrega.
- Conservar IndexedDB v3, respaldo v2 y restauración actual.
- Conservar Gemini, Cloudflare, endpoint, cuotas y evolución Tura sin cambios.
- Añadir solo un auditor de conexiones, pruebas de caracterización y este informe.

## Riesgos

- La medición de rendimiento es una muestra sin ralentización ni datos reales.
- El snapshot de heap no demuestra por sí solo ausencia de fugas.
- El estado oculto real requiere navegador/dispositivo interactivo.
- Las fuentes remotas agregan una dependencia externa para la apariencia.
- Las pruebas que caracterizan P1 y P2 deben invertirse al corregirlos en 6B.

## Propuesta priorizada para 6B

1. Dar propiedad explícita a `ExamSession` y liberar el intervalo al cambiar de
   vista, con prueba fallida, corrección mínima y comparación de actividad.
2. Hacer que el shell de instalación cubra todos los recursos locales
   alcanzables, con prueba offline de instalación nueva.
3. Verificar que la corrección del shell no aumenta fallos de instalación ni
   rompe la actualización de `2026.07.28-9`.
4. Mantener P3 para 6C y medir P4 con datos y dispositivos antes de optimizar.
