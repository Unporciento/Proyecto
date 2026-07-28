# Módulo de cierre 6B — Correcciones e integración

Fecha: 2026-07-28

Base auditada: `59d804910dce826c5a740ea77e2f170f988bbd32`

Alcance: corrección exclusiva de P1 y P2 confirmados en 6A.

## Secuencia aplicada

Cada defecto siguió:

1. reproducción existente de 6A;
2. expectativa de corrección;
3. prueba fallida;
4. corrección mínima;
5. prueba aprobada;
6. medición comparativa.

Antes de modificar producción, la prueba focalizada falló de esta forma:

- P1: dos inicios producían dos intervalos activos en vez de uno;
- P2: faltaban 29 scripts y seis hojas CSS en el shell;
- la versión esperada `2026.07.28-10` aún era `2026.07.28-9`.

## P1 — ciclo de vida de ExamSession

### Causa

`ExamSession.start()` creaba un intervalo sin liberar uno anterior. La instancia
se descartaba en `app.js`, por lo que el cambio de vista y un nuevo simulacro no
tenían propiedad sobre el temporizador. Solo `finish()` ejecutaba
`clearInterval()`.

### Corrección mínima

- `ExamSession.timer` es explícito y comienza en `null`.
- `stopTimer()` libera el intervalo y vuelve a `null`.
- `dispose()` es idempotente, libera el intervalo y retira el listener.
- La sesión escucha `forja:viewchange` y se cierra fuera de `examen`.
- `start()` libera cualquier intervalo anterior antes de crear otro.
- `startExamSession()` mantiene una única instancia activa y cierra la anterior.
- Finalizar detiene el intervalo; cerrar el resultado dispone la sesión.
- `answers` no se vacía al disponer, por lo que conserva respuestas enviadas.

`app.js` solo cambió la construcción directa por `startExamSession()` y conserva
exactamente 313 líneas.

### Medición

| Escenario | Antes | Después |
| --- | ---: | ---: |
| dos inicios consecutivos | 2 intervalos | 1 intervalo |
| abandonar la vista | 1 huérfano | 0 activos |
| 20 ciclos iniciar/abandonar | acumulación posible | máximo 1; final 0 |

Las reglas del simulacro, confianza, duración, Calibración, resultados y
persistencia de intentos no cambiaron.

## P2 — shell de instalación

### Causa

El Service Worker instalaba el núcleo y Buenaventura, pero omitía módulos y CSS
académicos que `index.html` y sus imports cargan de forma inmediata. La
estrategia network-first podía almacenarlos después, pero no garantizaba una
instalación nueva completa.

### Corrección mínima

- Se añadieron los 29 scripts conectados y seis hojas CSS identificados en 6A.
- El auditor informa cero scripts y cero estilos conectados ausentes.
- El Service Worker avanzó de `2026.07.28-9` a `2026.07.28-10`.
- No se añadieron Workers externos, endpoints, Gemini, Cloudflare, recursos
  dinámicos, datos académicos ni datos de usuario.

### Instalación offline

La prueba abre cada ruta de `SHELL` desde el repositorio durante `cache.addAll`.
Una ruta inexistente aborta la instalación. Después desactiva totalmente la red
y solicita cada recurso instalado mediante el handler `fetch`; todos responden
con estado 200 desde caché.

La actualización simulada desde `forja-shell-2026.07.28-9`:

- conserva `forja-shell-2026.07.28-10`;
- elimina únicamente la caché anterior;
- reclama los clientes;
- no contiene ni ejecuta operaciones IndexedDB.

Las pruebas de IndexedDB v3, restauración atómica y respaldo v2 permanecen
aprobadas.

## Integraciones verificadas

- Buenaventura conserva `UnavailableProvider` y `provider_unavailable`.
- Gemini, proxy Cloudflare, modelo, endpoint y contratos no cambiaron.
- Tura, respaldo, migraciones y repositorios académicos no cambiaron.
- No se corrigieron P3 ni P4.

## Archivos

- `js/sessions.js`: propiedad y cierre del ciclo de vida.
- `js/app.js`: uso del propietario único sin crecimiento.
- `service-worker.js`: shell completo y versión `2026.07.28-10`.
- `tests/closure-6a-audit.test.js`: expectativas corregidas y medición repetida.
- `tests/service-worker.test.js`: instalación offline y actualización segura.
- `tests/seams.test.js`: nueva versión esperada.
- `docs/CLOSURE-6B-CORRECTIONS.md`: evidencia de esta entrega.

## Riesgos pendientes

- P3 de contraste y nombres accesibles queda para 6C.
- P4 de carga inicial requiere medición en dispositivos antes de optimizar.
- La prueba offline simula Cache API de forma determinista; la validación en una
  PWA instalada real corresponde a 6C.
- La actualización real depende de que todas las rutas publicadas coincidan con
  el commit final; la prueba impide rutas locales inexistentes.

## Propuesta para 6C

1. Medir CPU, memoria y batería en dispositivo real antes de optimizar.
2. Repetir volumen pequeño, mediano y grande en móvil, iPhone y tablet.
3. Corregir P3 con pruebas de contraste y nombres accesibles.
4. Validar instalación, offline y actualización real de la PWA.
5. Investigar P4 únicamente si las mediciones móviles demuestran impacto.
