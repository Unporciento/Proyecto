# Módulo de cierre 6C — Optimización medida, dispositivos y accesibilidad

Fecha: 2026-07-28

Base: `5c995ba6166d29a4e99f59274326ee65baf41b98`

Alcance: medir, corregir P3, investigar P4 y validar dispositivos, PWA,
offline y segundo plano. No incluye documentación final ni certificación 6D.

## Entorno y límites

- Chrome DevTools MCP, CPU limitada a 4× y red Fast 3G.
- Vista de escritorio: 1366 × 768.
- Emulaciones: iPhone 390 × 844 y 844 × 390; teclado virtual aproximado
  390 × 500; Android 412 × 915; tablet 768 × 1024 y 1024 × 768.
- El servidor local usa HTTP/1.1 y desactiva caché HTTP; por eso la primera
  instalación no representa por sí sola GitHub Pages.
- No se escribió contenido sintético en IndexedDB. Los volúmenes se midieron
  mediante render en memoria y las pruebas existentes con `fake-indexeddb`.
- Chrome no sustituye una prueba física en Safari/iPhone ni puede marcar esta
  pestaña como realmente oculta en esta sesión. Esas validaciones quedan como
  comprobaciones manuales.

## Línea base y medición posterior

| Medición limitada | Antes (6B) | Después (6C) |
| --- | ---: | ---: |
| LCP, instalación fría local | 2.813 s | 2.861 s |
| LCP, carga caliente con SW | 1.080 s | 0.952 s |
| CLS | 0.00 | 0.00 |
| navegación repetida, mediana por vista | 85.3 ms | 90.1 ms |
| diálogo repetido, mediana por ciclo | 109.2 ms | 108.6 ms |
| intervalos al terminar | 0 | 0 |
| llamadas externas/Gemini | 0 | 0 |

La variación fría de +1.7 % y la de navegación de +5.6 % no son una mejora ni
una regresión concluyente en una sola máquina. La carga caliente mejoró 11.9 %,
pero tampoco se atribuye a una optimización porque 6C no cambió la topología de
carga. Los cambios de 6C son de accesibilidad y disposición.

En tres recorridos posteriores de 120 vistas y 60 diálogos, la memoria creció
119 KB, 51 KB y 235 KB según la muestra. No hubo crecimiento monotónico,
intervalos activos ni solicitudes externas. Las tareas largas aparecieron bajo
CPU 4× durante el render repetido; no persistieron como actividad autónoma.

## Volúmenes

| Datos renderizados en memoria, CPU 4× | Tiempo |
| --- | ---: |
| 0 proyectos | 5.8 ms |
| página real máxima de 60 proyectos, mediana | 590.5 ms |
| 100 proyectos sin paginar | 1.192 s |
| 500 proyectos sin paginar | 5.556 s |

La interfaz productiva pagina a 60. Las pruebas de persistencia existentes
cubren 200 proyectos, 20.000 artefactos y 50.000 relaciones sin tocar la base
real del navegador.

## P3 — accesibilidad

### Reproducción

Lighthouse falló en:

- contraste de 15 nodos en escritorio y 12 en móvil;
- nombre accesible distinto del texto visible en la marca y el perfil.

La vista con teclado virtual y la orientación horizontal también dejaban el
diálogo fuera de la ventana. Con texto al 200 %, el título de Buenaventura
desbordaba su panel.

### Corrección mínima

- La paleta clara usa colores de texto AA y transforma cualquier acento elegido
  a una variante de la misma familia con contraste mínimo 4.5:1.
- La marca obtiene su nombre del texto visible.
- Las iniciales o la imagen del perfil son decorativas y el botón anuncia
  `Abrir perfil local de {nombre}`.
- Los diálogos limitan su altura a la ventana dinámica y permiten desplazarse.
- El título de Buenaventura puede partir palabras en ampliación extrema.

### Resultado

| Lighthouse | Antes | Después |
| --- | ---: | ---: |
| Accesibilidad escritorio | 95 | 100 |
| Accesibilidad móvil | 95 | 100 |
| Fallos binarios | 2 | 0 |
| Buenas prácticas / SEO / Agentic | 100 / 100 / 100 | 100 / 100 / 100 |

## P4 — decisión

Se mantienen los 77 módulos iniciales. No se aplicó carga diferida:

- el LCP caliente es 0.952 s y el de producción medido en 6A fue 0.788 s;
- el trazado local frío muestra 2.861 s, pero mezcla HTTP/1.1, caché HTTP
  desactivada y una instalación completa del shell;
- el ahorro estimado de recursos bloqueantes fue 0 ms en caliente;
- diferir módulos arriesgaría navegación, CSP, offline e imports sin una mejora
  productiva demostrada.

P4 queda documentado, no corregido por intuición. Una futura decisión requiere
mediciones repetibles en iPhone Safari y Android físicos.

## Dispositivos y entrada

- iPhone estrecho: sin desbordamiento; Buenaventura queda dentro de 362 px.
- Teclado virtual aproximado: diálogo termina en 490.2 px de 500 y desplaza.
- iPhone horizontal: diálogo termina en 380.6 px de 390 y desplaza.
- Texto al 200 %: documento, panel y título conservan su ancho.
- Android y tablet en ambas orientaciones: cero botones fuera del ancho.
- Teclado: foco visible, Enter cambia a la vista enfocada.
- Táctil: emulación activa y controles sin desbordamiento.
- Safe areas: se conservan `env(safe-area-inset-top/bottom)` y botones inferiores.

## PWA, actualización y offline

- Service Worker final: `2026.07.28-10`.
- Instalación local nueva: una caché, 94 respuestas, ninguna ruta inexistente.
- Recarga y seis vistas funcionaron con la red bloqueada por DevTools.
- IndexedDB siguió como `forja-estudio`, versión 3, antes y después.
- No hubo solicitudes a Gemini; Buenaventura conserva su degradación
  `UnavailableProvider` cubierta por contratos.
- La actualización determinista elimina `2026.07.28-9`, conserva
  `2026.07.28-10` y no ejecuta operaciones IndexedDB.
- El manifiesto conserva `display: standalone`. La instalación física no puede
  automatizarse en este entorno.

## Batería y segundo plano

- Simulacro: 20 ciclos alcanzan como máximo un intervalo y terminan en cero.
- Navegación y diálogos: cero intervalos y cero temporizadores al finalizar.
- No existen reintentos automáticos ni llamadas Gemini en segundo plano.
- `prefers-reduced-motion` y el modo ahorro anulan animaciones y transiciones.
- `data-page-hidden` pausa animaciones.
- Al cambiar de pestaña mediante MCP no se emitió `visibilitychange`; durante
  19.8 s se observaron cero mutaciones y cero solicitudes. Esto no sustituye la
  medición energética en un dispositivo físico.

## Archivos de producto modificados

- `css/tokens.css`
- `css/responsive.css`
- `css/buenaventura.css`
- `index.html`
- `js/profile.js`
- `js/theme.js`

Pruebas modificadas: `tests/core.test.js` y `tests/ux.test.js`.

No cambiaron Gemini, Cloudflare, Tura, IndexedDB, respaldos, migraciones,
repositorios académicos, contratos, `app.js` ni `academic-repository.js`.

## Riesgos para 6D

- Falta confirmar Safari/iPhone físico, instalación PWA real y consumo de
  batería con instrumentos del sistema.
- P4 permanece como riesgo medido solo en instalación fría local limitada.
- La memoria de Chrome es aproximada y requiere perfil prolongado físico para
  establecer un presupuesto definitivo.
- Los colores personalizados extremos conservan contraste, pero conviene una
  revisión visual humana de identidad en modo claro.

