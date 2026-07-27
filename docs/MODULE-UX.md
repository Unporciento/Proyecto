# Módulo UX — Identidad y experiencia

Estado: implementado técnicamente  
Fecha: 2026-07-26

## Responsabilidad

Este módulo reúne identidad y estados globales sin incorporar reglas académicas.
`js/ux/ux-controller.js` no accede a IndexedDB ni modifica `app.js`.

## Incluido

- Identidad FORJA, favicon, metadatos PWA y versión visible `2.0.0`.
- Footer con copyright y año calculado en el navegador.
- Pantalla de carga breve con salida automática de seguridad.
- Banner accesible al perder conexión.
- Páginas estáticas `404.html` y `offline.html`.
- Mensaje global seguro para errores y promesas rechazadas.
- Estados vacíos existentes revisados para los módulos académicos.
- Microinteracciones discretas desactivables por ahorro o movimiento reducido.
- Controles táctiles, áreas seguras y diseño adaptable existentes conservados.

Las acciones destructivas mantienen confirmaciones explícitas. El mensaje global
no muestra detalles técnicos ni contenido del usuario; esos diagnósticos
pertenecen al Laboratorio.

## Service Worker

Versión `2026.07.26-5`. Precarga las páginas de recuperación y los recursos UX.
La navegación offline de FORJA conserva el shell funcional existente.

## Riesgos

- La apariencia y el teclado deben validarse físicamente en Safari iPhone.
- La página offline solo aparece como recurso de recuperación; el shell principal
  sigue siendo la primera opción cuando ya está guardado.
